from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import selectinload

from api.core.dependencies import DbSession
from api.core.responses import (
    RESPONSE_CONFLICT_STOCK,
    RESPONSE_UNAUTHORIZED,
    RESPONSE_UNPROCESSABLE_ENTITY,
    RESPONSE_UNSUPPORTED_MEDIA_TYPE,
)
from api.schemas.analysis import AnalysisResultRead
from api.schemas.report import CompanyReportRead
from api.schemas.stock import (
    FundamentalDataRead,
    StockCreate,
    StockPriceRead,
    StockRead,
    StockResolveResponse,
    StockUpdate,
)
from screener.services.analysis_service import AnalysisService
from screener.services.report_service import ReportService
from screener.services.stock_service import StockService

router = APIRouter(
    prefix="/stocks",
    tags=["Stocks"],
)


@router.get(
    "",
    response_model=list[StockRead],
    summary="List and search stocks",
    description="Retrieve a list of stored stocks, optionally filtered by ISIN, WKN, Ticker, or Name.",
    responses={
        200: {"description": "List of stocks"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def list_stocks(
    db: DbSession,
    query: str | None = Query(default=None, description="Search term for ISIN, WKN, Ticker or Name"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return StockService.get_stocks(db, query=query, limit=limit, offset=offset)


@router.post(
    "",
    response_model=StockRead,
    status_code=201,
    summary="Create or retrieve a stock",
    description=(
        "Registers a new stock or returns an existing one if the ISIN, WKN, or Ticker is already present. "
        "Attempts to automatically enrich stock metadata via the active data provider."
    ),
    responses={
        201: {"description": "Stock created or retrieved successfully"},
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNSUPPORTED_MEDIA_TYPE,
        **RESPONSE_UNPROCESSABLE_ENTITY,
        **RESPONSE_CONFLICT_STOCK,
    },
)
def create_stock(payload: StockCreate, db: DbSession):
    return StockService.resolve_and_create_stock(
        db=db,
        isin=payload.isin,
        wkn=payload.wkn,
        ticker=payload.ticker,
        name=payload.name,
        exchange=payload.exchange,
        currency=payload.currency,
    )


@router.get(
    "/{stock_id}",
    response_model=StockRead,
    summary="Get stock details",
    description="Retrieve full stock information by its database ID.",
    responses={
        200: {"description": "Stock details"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_stock(stock_id: int, db: DbSession):
    stock = StockService.get_stock_by_id(db, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return stock


@router.post(
    "/{stock_id}/sync",
    response_model=StockRead,
    summary="Sync market and fundamental data",
    description="Fetches recent historical prices and fundamental metrics from the active provider.",
    responses={
        200: {"description": "Data synchronized successfully"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def sync_stock_data(stock_id: int, db: DbSession):
    return StockService.sync_market_and_fundamental_data(db, stock_id)


@router.get(
    "/{stock_id}/prices",
    response_model=list[StockPriceRead],
    summary="Get stock price history",
    responses={
        200: {"description": "List of historical prices"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_stock_prices(stock_id: int, db: DbSession):
    stock = StockService.get_stock_by_id(db, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return sorted(stock.prices, key=lambda p: p.date, reverse=True)


@router.get(
    "/{stock_id}/fundamentals",
    response_model=list[FundamentalDataRead],
    summary="Get fundamental data periods",
    responses={
        200: {"description": "List of fundamental data periods"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_stock_fundamentals(stock_id: int, db: DbSession):
    stock = StockService.get_stock_by_id(db, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return sorted(stock.fundamentals, key=lambda f: (f.fiscal_year or 0, f.fiscal_period or ""), reverse=True)


@router.post(
    "/resolve",
    response_model=StockResolveResponse,
    summary="Preview stock identifier resolution",
    description="Resolves an ISIN, WKN, or Ticker via database or active provider without creating the record.",
)
def resolve_stock(query: str = Query(..., description="ISIN, WKN or Ticker to look up"), db: DbSession = None):
    return StockService.resolve_preview(db, query=query)


@router.post(
    "/sync-all",
    summary="Sync all stocks",
    description="Fetches recent historical prices and fundamentals for all stored stocks.",
)
def sync_all_stocks(db: DbSession):
    count = StockService.sync_all_stocks(db)
    return {"message": f"Successfully synchronized {count} stocks.", "synced_count": count}


@router.patch(
    "/{stock_id}",
    response_model=StockRead,
    summary="Update stock details",
    description="Updates stock master data fields.",
)
def update_stock(stock_id: int, payload: StockUpdate, db: DbSession):
    return StockService.update_stock(
        db,
        stock_id,
        name=payload.name,
        exchange=payload.exchange,
        currency=payload.currency,
        sector=payload.sector,
        industry=payload.industry,
        country=payload.country,
        wkn=payload.wkn,
        isin=payload.isin,
        ticker=payload.ticker,
    )


@router.delete(
    "/{stock_id}",
    status_code=204,
    summary="Delete stock",
    description="Deletes a stock and related data.",
)
def delete_stock(stock_id: int, db: DbSession):
    StockService.delete_stock(db, stock_id)
    return None


@router.get(
    "/{stock_id}/reports",
    response_model=list[CompanyReportRead],
    summary="Get company reports",
    responses={
        200: {"description": "List of company reports and analyses"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_stock_reports(stock_id: int, db: DbSession):
    stock = StockService.get_stock_by_id(db, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return ReportService.get_reports_for_stock(db, stock_id)


@router.get(
    "/{stock_id}/analyses",
    response_model=list[AnalysisResultRead],
    summary="Get historical analyses for stock",
    responses={
        200: {"description": "List of versioned analysis results"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_stock_analyses(stock_id: int, db: DbSession):
    stock = StockService.get_stock_by_id(db, stock_id)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")
    return AnalysisService.get_stock_analyses(db, stock_id)
