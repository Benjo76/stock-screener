""" Base financial data provider interface """

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any


@dataclass
class StockProfile:
    symbol: str
    name: str | None = None
    isin: str | None = None
    wkn: str | None = None
    currency: str = "USD"
    exchange: str | None = None
    sector: str | None = None
    industry: str | None = None
    country: str | None = None
    description: str | None = None


@dataclass
class HistoricalPriceData:
    date: date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float = 0.0
    adjusted_close: float | None = None
    volume: int | None = None
    currency: str = "USD"
    data_source: str = "provider"


@dataclass
class FundamentalPeriodData:
    period_type: str = "annual"  # annual, quarterly, ttm
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
    capital_expenditures: float | None = None
    total_assets: float | None = None
    total_equity: float | None = None
    total_debt: float | None = None
    cash_and_equivalents: float | None = None
    current_ratio: float | None = None
    debt_to_equity: float | None = None
    dividend_per_share: float | None = None
    dividend_yield: float | None = None
    pe_ratio: float | None = None
    ps_ratio: float | None = None
    pb_ratio: float | None = None
    currency: str = "USD"
    data_source: str = "provider"
    raw_data: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReportDocumentData:
    report_type: str  # ANNUAL, QUARTERLY, 10-K, 10-Q, PRESS_RELEASE
    fiscal_year: int | None = None
    fiscal_period: str | None = None
    report_date: date | None = None
    title: str | None = None
    content_text: str | None = None
    file_path: str | None = None
    source_url: str | None = None
    data_source: str = "provider"


class BaseDataProvider(ABC):
    """Abstract interface for market and fundamental data providers."""

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Name of the data provider."""
        pass

    @abstractmethod
    def lookup_stock(self, identifier: str) -> StockProfile | None:
        """Lookup stock profile by ISIN, WKN or Ticker."""
        pass

    @abstractmethod
    def get_historical_prices(
        self,
        identifier: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[HistoricalPriceData]:
        """Fetch historical price data."""
        pass

    @abstractmethod
    def get_fundamental_data(self, identifier: str) -> list[FundamentalPeriodData]:
        """Fetch fundamental data across periods."""
        pass

    @abstractmethod
    def get_company_reports(self, identifier: str) -> list[ReportDocumentData]:
        """Fetch recent company reports."""
        pass
