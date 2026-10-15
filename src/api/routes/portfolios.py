from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from api.dependencies import DbSession
from api.responses import (
    RESPONSE_UNAUTHORIZED,
    RESPONSE_UNPROCESSABLE_ENTITY,
)
from api.schemas.analysis import AnalysisResultRead
from api.schemas.portfolio import (
    CsvImportPreviewResponse,
    CsvImportRequest,
    CsvImportResultResponse,
    PortfolioCreate,
    PortfolioHoldingCreate,
    PortfolioHoldingRead,
    PortfolioRead,
    PortfolioSummaryRead,
    PortfolioTransactionCreate,
    PortfolioTransactionRead,
    PortfolioUpdate,
)
from screener.services.analysis_service import AnalysisService
from screener.services.portfolio_service import PortfolioService

router = APIRouter(
    prefix="/portfolios",
    tags=["Portfolios"],
)


@router.get(
    "",
    response_model=list[PortfolioRead],
    summary="List all portfolios",
    responses={
        200: {"description": "List of portfolios"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def list_portfolios(db: DbSession):
    return PortfolioService.get_portfolios(db)


@router.post(
    "",
    response_model=PortfolioRead,
    status_code=201,
    summary="Create a new portfolio",
    responses={
        201: {"description": "Portfolio created"},
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNPROCESSABLE_ENTITY,
    },
)
def create_portfolio(payload: PortfolioCreate, db: DbSession):
    return PortfolioService.create_portfolio(
        db=db,
        name=payload.name,
        description=payload.description,
        currency=payload.currency,
    )


@router.get(
    "/{portfolio_id}",
    response_model=PortfolioRead,
    summary="Get portfolio details",
    description="Retrieve full portfolio information including current holdings and transactions.",
    responses={
        200: {"description": "Portfolio details"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_portfolio(portfolio_id: int, db: DbSession):
    portfolio = PortfolioService.get_portfolio_by_id(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio


@router.delete(
    "/{portfolio_id}",
    summary="Delete portfolio",
    responses={
        200: {"description": "Portfolio deleted"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def delete_portfolio(portfolio_id: int, db: DbSession):
    success = PortfolioService.delete_portfolio(db, portfolio_id)
    if not success:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"status": "ok", "message": f"Portfolio {portfolio_id} deleted"}


@router.post(
    "/{portfolio_id}/import/preview",
    response_model=CsvImportPreviewResponse,
    summary="Preview and validate CSV import",
    description="Parses CSV text or file, validates columns and rows, and reports errors without modifying the database.",
    responses={
        200: {"description": "CSV Preview and Validation Results"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNPROCESSABLE_ENTITY,
    },
)
def preview_csv_import(
    portfolio_id: int,
    payload: CsvImportRequest,
    db: DbSession,
):
    portfolio = PortfolioService.get_portfolio_by_id(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")

    result = PortfolioService.preview_csv_import(
        csv_content=payload.csv_content,
        forced_type=payload.forced_type,
    )

    preview_items = []
    if result.import_type == "holdings":
        for r in result.holdings[:25]:
            preview_items.append({
                "row_number": r.row_number,
                "isin": r.isin,
                "wkn": r.wkn,
                "ticker": r.ticker,
                "name": r.name,
                "shares": r.shares,
                "average_buy_price": r.average_buy_price,
                "purchase_price": r.purchase_price or r.average_buy_price,
                "current_price": r.current_price,
                "price": r.purchase_price or r.average_buy_price,
                "total_cost": r.total_cost,
                "currency": r.currency,
                "is_valid": r.is_valid,
                "errors": r.errors,
            })
    elif result.import_type == "transactions":
        for r in result.transactions[:25]:
            preview_items.append({
                "row_number": r.row_number,
                "isin": r.isin,
                "wkn": r.wkn,
                "ticker": r.ticker,
                "name": r.name,
                "transaction_type": r.transaction_type,
                "transaction_date": r.transaction_date.isoformat() if r.transaction_date else None,
                "shares": r.shares,
                "price_per_share": r.price_per_share,
                "total_amount": r.total_amount,
                "fees": r.fees,
                "currency": r.currency,
                "is_valid": r.is_valid,
                "errors": r.errors,
            })

    return CsvImportPreviewResponse(
        import_type=result.import_type,
        total_rows=result.total_rows,
        valid_rows_count=result.valid_rows_count,
        invalid_rows_count=result.invalid_rows_count,
        errors=result.errors,
        warnings=result.warnings,
        preview_items=preview_items,
    )


@router.post(
    "/{portfolio_id}/import",
    response_model=CsvImportResultResponse,
    summary="Execute CSV import",
    description="Imports verified holdings snapshot or transaction history into the specified portfolio.",
    responses={
        200: {"description": "CSV Import Result"},
        400: {"description": "CSV format error"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNPROCESSABLE_ENTITY,
    },
)
def execute_csv_import(
    portfolio_id: int,
    payload: CsvImportRequest,
    db: DbSession,
):
    return PortfolioService.execute_csv_import(
        db=db,
        portfolio_id=portfolio_id,
        csv_content=payload.csv_content,
        forced_type=payload.forced_type,
    )


@router.get(
    "/{portfolio_id}/analyses",
    response_model=list[AnalysisResultRead],
    summary="Get portfolio analyses history",
    responses={
        200: {"description": "List of portfolio analysis results"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_portfolio_analyses(portfolio_id: int, db: DbSession):
    portfolio = PortfolioService.get_portfolio_by_id(db, portfolio_id)
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return AnalysisService.get_portfolio_analyses(db, portfolio_id)


@router.patch(
    "/{portfolio_id}",
    response_model=PortfolioRead,
    summary="Update portfolio details",
)
def update_portfolio(portfolio_id: int, payload: PortfolioUpdate, db: DbSession):
    return PortfolioService.update_portfolio(
        db,
        portfolio_id,
        name=payload.name,
        description=payload.description,
        currency=payload.currency,
    )


@router.get(
    "/{portfolio_id}/summary",
    response_model=PortfolioSummaryRead,
    summary="Get calculated portfolio summary and allocations",
)
def get_portfolio_summary(portfolio_id: int, db: DbSession):
    return PortfolioService.get_portfolio_summary(db, portfolio_id)


@router.post(
    "/{portfolio_id}/holdings",
    response_model=PortfolioHoldingRead,
    summary="Add or update portfolio holding",
)
def add_holding(portfolio_id: int, payload: PortfolioHoldingCreate, db: DbSession):
    avg_price = payload.average_buy_price if payload.average_buy_price is not None else (payload.purchase_price if payload.purchase_price is not None else payload.price)
    return PortfolioService.add_or_update_holding(
        db=db,
        portfolio_id=portfolio_id,
        stock_id=payload.stock_id,
        isin=payload.isin,
        wkn=payload.wkn,
        ticker=payload.ticker,
        name=payload.name,
        shares=payload.shares,
        average_buy_price=avg_price,
        current_price=payload.current_price,
        currency=payload.currency,
    )


@router.delete(
    "/{portfolio_id}/holdings/{holding_id}",
    status_code=204,
    summary="Delete portfolio holding",
)
def delete_holding(portfolio_id: int, holding_id: int, db: DbSession):
    PortfolioService.delete_holding(db, portfolio_id, holding_id)
    return None


@router.post(
    "/{portfolio_id}/transactions",
    response_model=PortfolioTransactionRead,
    summary="Add portfolio transaction",
)
def add_transaction(portfolio_id: int, payload: PortfolioTransactionCreate, db: DbSession):
    return PortfolioService.add_transaction(
        db=db,
        portfolio_id=portfolio_id,
        stock_id=payload.stock_id,
        transaction_type=payload.transaction_type,
        shares=payload.shares,
        price_per_share=payload.price_per_share,
        total_amount=payload.total_amount,
        fees=payload.fees,
        currency=payload.currency,
        transaction_date=payload.transaction_date,
        notes=payload.notes,
    )
