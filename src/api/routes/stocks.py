from fastapi import APIRouter
from fastapi.security import APIKeyHeader

from api.dependencies import DbSession
from api.responses import (
    RESPONSE_CONFLICT_STOCK,
    RESPONSE_UNAUTHORIZED,
    RESPONSE_UNPROCESSABLE_ENTITY,
    RESPONSE_UNSUPPORTED_MEDIA_TYPE,
)
from api.schemas.stock import StockCreate, StockRead
from api.services.stock_service import StockService

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False, description="API Key for authentication")

router = APIRouter(
    prefix="/stocks",
    tags=["Stocks"],
    dependencies=[],
)


@router.get(
    "",
    response_model=list[StockRead],
    summary="List stocks",
    description="Retrieve a list of all stored stocks, ordered by their internal ID.",
    responses={
        200: {
            "description": "List of stocks",
        },
        **RESPONSE_UNAUTHORIZED,
    },
)
def list_stocks(db: DbSession):
    return StockService.get_stocks(db)


@router.post(
    "",
    response_model=StockRead,
    status_code=201,
    summary="Create or retrieve a stock",
    description=(
        "Registers a new stock or returns an existing one if the ISIN is already present. "
        "Requires at least an ISIN (WKN-only lookup is not yet supported)."
    ),
    responses={
        201: {
            "description": "Stock created or retrieved successfully",
        },
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNSUPPORTED_MEDIA_TYPE,
        **RESPONSE_UNPROCESSABLE_ENTITY,
        **RESPONSE_CONFLICT_STOCK,
    },
)
def create_stock(payload: StockCreate, db: DbSession):
    return StockService.create_stock(db, payload)
