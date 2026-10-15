from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

from api.schemas.stock import StockRead


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Portfolio name", examples=["Mein Hauptdepot"])
    description: str | None = Field(
        default=None, description="Optional description", examples=["Langfristiges Buy & Hold Depot"]
    )
    currency: str = Field(default="EUR", min_length=3, max_length=3, description="Base currency", examples=["EUR"])


class PortfolioHoldingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int
    stock_id: int
    stock: StockRead | None = None
    shares: float
    average_buy_price: float | None = None
    purchase_price: float | None = None
    current_price: float | None = None
    total_cost: float | None = None
    currency: str | None = None
    data_source: str | None = None
    last_imported_at: datetime | None = None


class PortfolioTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    portfolio_id: int
    stock_id: int
    stock: StockRead | None = None
    transaction_type: str
    shares: float | None = None
    price_per_share: float | None = None
    total_amount: float
    fees: float
    currency: str | None = None
    transaction_date: datetime
    external_transaction_id: str | None = None
    notes: str | None = None


class PortfolioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    currency: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    holdings: list[PortfolioHoldingRead] = []
    transactions: list[PortfolioTransactionRead] = []


class CsvImportRequest(BaseModel):
    csv_content: str = Field(description="Raw CSV content to import or validate")
    forced_type: Literal["holdings", "transactions"] | None = Field(
        default=None,
        description="Optionally force CSV parsing mode (holdings snapshot or transaction history)",
    )


class CsvParsedItem(BaseModel):
    row_number: int
    raw_data: dict[str, Any]
    isin: str | None = None
    wkn: str | None = None
    ticker: str | None = None
    name: str | None = None
    shares: float | None = None
    price: float | None = None
    purchase_price: float | None = None
    current_price: float | None = None
    average_buy_price: float | None = None
    total_amount: float | None = None
    transaction_type: str | None = None
    currency: str | None = None
    is_valid: bool
    errors: list[str] = []


class CsvImportPreviewResponse(BaseModel):
    import_type: str
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    errors: list[str] = []
    warnings: list[str] = []
    preview_items: list[dict[str, Any]] = []


class CsvImportResultResponse(BaseModel):
    portfolio_id: int
    import_type: str
    total_rows: int
    imported_count: int
    skipped_count: int
    row_errors: list[dict[str, Any]] = []


class PortfolioUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    currency: str | None = None


class PortfolioHoldingCreate(BaseModel):
    stock_id: int | None = None
    isin: str | None = None
    wkn: str | None = None
    ticker: str | None = None
    name: str | None = None
    shares: float = Field(gt=0, description="Number of shares")
    average_buy_price: float | None = Field(default=None, ge=0, description="Average cost basis per share")
    purchase_price: float | None = Field(
        default=None, ge=0, description="Purchase price per share (alias for average_buy_price)"
    )
    current_price: float | None = Field(default=None, ge=0, description="Current market price per share")
    price: float | None = Field(default=None, ge=0, description="Price per share (fallback)")
    currency: str = Field(default="EUR", min_length=3, max_length=3)


class PortfolioTransactionCreate(BaseModel):
    stock_id: int
    transaction_type: str = Field(default="BUY", description="BUY, SELL, DIVIDEND, FEE, SPLIT")
    shares: float | None = Field(default=None, description="Number of shares")
    price_per_share: float | None = Field(default=None, ge=0)
    total_amount: float = Field(description="Total transaction volume")
    fees: float = Field(default=0.0, ge=0)
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    transaction_date: datetime | None = None
    notes: str | None = None


class PortfolioSummaryRead(BaseModel):
    portfolio_id: int
    name: str
    currency: str
    total_cost: float | None = None
    total_value: float | None = None
    total_gain_loss: float | None = None
    total_return_pct: float | None = None
    positions_count: int = 0
    top_holdings: list[dict[str, Any]] = []
    sector_allocation: dict[str, float] = {}
    currency_allocation: dict[str, float] = {}
