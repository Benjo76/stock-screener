from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field

from api.schemas.analysis import AnalysisJobRead, AnalysisResultRead
from api.schemas.report import CompanyReportRead


class SystemStatusRead(BaseModel):
    status: str
    database: str
    active_provider: str
    available_providers: list[str]
    version: str
    total_stocks: int
    total_portfolios: int
    total_reports: int
    total_jobs: int


class TopPositionItem(BaseModel):
    stock_id: int
    portfolio_id: int
    portfolio_name: str
    name: str | None = None
    ticker: str | None = None
    isin: str | None = None
    shares: float
    average_buy_price: float | None = None
    current_price: float | None = None
    total_cost: float | None = None
    market_value: float | None = None
    gain_loss: float | None = None
    return_pct: float | None = None
    currency: str = "EUR"
    weight_pct: float | None = None
    sector: str | None = None


class DataWarningItem(BaseModel):
    severity: str  # "warning", "info", "error"
    stock_id: int | None = None
    stock_name: str | None = None
    message: str
    recommendation: str | None = None


class HistoricalPerformanceItem(BaseModel):
    date: str
    total_value: float
    total_cost: float


class DashboardSummaryRead(BaseModel):
    total_portfolio_value: float | None = None
    total_invested_cost: float | None = None
    total_unrealized_gain_loss: float | None = None
    total_unrealized_return_pct: float | None = None
    currency: str = "EUR"
    portfolios_count: int = 0
    stocks_count: int = 0
    holdings_count: int = 0
    top_positions: list[TopPositionItem] = []
    sector_allocation: dict[str, float] = {}
    currency_allocation: dict[str, float] = {}
    recent_analyses: list[AnalysisResultRead] = []
    recent_jobs: list[AnalysisJobRead] = []
    recent_reports: list[CompanyReportRead] = []
    data_warnings: list[DataWarningItem] = []
    performance_history: list[HistoricalPerformanceItem] = []
