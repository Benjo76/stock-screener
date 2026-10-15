from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class StockCreate(BaseModel):
    isin: str | None = Field(
        default=None,
        min_length=12,
        max_length=12,
        description="International Securities Identification Number (12 characters)",
        examples=["US0378331005"],
    )
    wkn: str | None = Field(
        default=None,
        min_length=6,
        max_length=6,
        description="Wertpapierkennnummer (6 characters)",
        examples=["865985"],
    )
    ticker: str | None = Field(
        default=None,
        max_length=32,
        description="Stock ticker symbol",
        examples=["AAPL"],
    )
    name: str | None = Field(
        default=None,
        max_length=255,
        description="Company / stock name",
        examples=["Apple Inc."],
    )
    exchange: str | None = Field(
        default=None,
        max_length=100,
        description="Exchange name",
        examples=["NASDAQ"],
    )
    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        description="ISO 4217 Currency Code (3 characters)",
        examples=["USD"],
    )


class StockPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float
    adjusted_close: float | None = None
    volume: int | None = None
    currency: str | None = None
    data_source: str


class FundamentalDataRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    period_type: str
    fiscal_year: int | None = None
    fiscal_period: str | None = None
    period_end_date: date | None = None
    revenue: float | None = None
    gross_profit: float | None = None
    operating_income: float | None = None
    net_income: float | None = None
    eps: float | None = None
    gross_margin: float | None = None
    operating_margin: float | None = None
    net_margin: float | None = None
    operating_cash_flow: float | None = None
    free_cash_flow: float | None = None
    total_debt: float | None = None
    cash_and_equivalents: float | None = None
    current_ratio: float | None = None
    debt_to_equity: float | None = None
    dividend_per_share: float | None = None
    dividend_yield: float | None = None
    pe_ratio: float | None = None
    ps_ratio: float | None = None
    pb_ratio: float | None = None
    currency: str | None = None
    data_source: str
    created_at: datetime | None = None


class StockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Unique internal ID of the stock", examples=[1])
    isin: str | None = Field(
        default=None,
        description="International Securities Identification Number",
        examples=["US0378331005"],
    )
    wkn: str | None = Field(
        default=None,
        description="Wertpapierkennnummer",
        examples=["865985"],
    )
    ticker: str | None = Field(
        default=None,
        description="Stock ticker symbol",
        examples=["AAPL"],
    )
    name: str | None = Field(
        default=None,
        description="Company / stock name",
        examples=["Apple Inc."],
    )
    exchange: str | None = Field(
        default=None,
        description="Exchange name",
        examples=["NASDAQ"],
    )
    currency: str | None = Field(
        default=None,
        description="ISO 4217 Currency Code",
        examples=["USD"],
    )
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    created_at: datetime | None = None


class StockUpdate(BaseModel):
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    wkn: str | None = None
    isin: str | None = None
    ticker: str | None = None


class StockResolveResponse(BaseModel):
    resolved: bool
    isin: str | None = None
    wkn: str | None = None
    ticker: str | None = None
    name: str | None = None
    exchange: str | None = None
    currency: str | None = None
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    provider: str | None = None
    message: str | None = None
