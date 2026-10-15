""" Mock / Offline Data Provider for deterministic local operations and testing """

from datetime import date, datetime, timedelta
from typing import Any

from screener.providers.base import (
    BaseDataProvider,
    FundamentalPeriodData,
    HistoricalPriceData,
    ReportDocumentData,
    StockProfile,
)


class MockDataProvider(BaseDataProvider):
    """Provides consistent offline data for testing and demonstrations."""

    def __init__(self):
        self._stocks = {
            "US0378331005": StockProfile(
                symbol="AAPL",
                name="Apple Inc.",
                isin="US0378331005",
                wkn="865985",
                currency="USD",
                exchange="NASDAQ",
                sector="Technology",
                industry="Consumer Electronics",
                country="USA",
                description="Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.",
            ),
            "865985": StockProfile(
                symbol="AAPL",
                name="Apple Inc.",
                isin="US0378331005",
                wkn="865985",
                currency="USD",
                exchange="NASDAQ",
                sector="Technology",
                industry="Consumer Electronics",
                country="USA",
            ),
            "AAPL": StockProfile(
                symbol="AAPL",
                name="Apple Inc.",
                isin="US0378331005",
                wkn="865985",
                currency="USD",
                exchange="NASDAQ",
                sector="Technology",
                industry="Consumer Electronics",
                country="USA",
            ),
            "DE0007164600": StockProfile(
                symbol="SAP.DE",
                name="SAP SE",
                isin="DE0007164600",
                wkn="716460",
                currency="EUR",
                exchange="XETRA",
                sector="Technology",
                industry="Software - Application",
                country="Germany",
                description="SAP SE operates as an enterprise application software company worldwide.",
            ),
            "716460": StockProfile(
                symbol="SAP.DE",
                name="SAP SE",
                isin="DE0007164600",
                wkn="716460",
                currency="EUR",
                exchange="XETRA",
                sector="Technology",
                industry="Software - Application",
                country="Germany",
            ),
            "US5949181045": StockProfile(
                symbol="MSFT",
                name="Microsoft Corporation",
                isin="US5949181045",
                wkn="870747",
                currency="USD",
                exchange="NASDAQ",
                sector="Technology",
                industry="Software - Infrastructure",
                country="USA",
            ),
        }

    @property
    def provider_name(self) -> str:
        return "mock_provider"

    def lookup_stock(self, identifier: str) -> StockProfile | None:
        key = identifier.strip().upper()
        if key in self._stocks:
            return self._stocks[key]
        
        # Generic fallback for test ISINs
        if len(key) == 12 and key[:2].isalpha():
            return StockProfile(
                symbol=key[:4],
                name=f"Security {key}",
                isin=key,
                currency="EUR",
                exchange="XETRA",
            )
        return None

    def get_historical_prices(
        self,
        identifier: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[HistoricalPriceData]:
        end = end_date or date.today()
        start = start_date or (end - timedelta(days=365))
        
        prices: list[HistoricalPriceData] = []
        cur_date = start
        base_price = 150.0
        
        while cur_date <= end:
            # Skip weekends
            if cur_date.weekday() < 5:
                day_offset = (cur_date - start).days
                # Generate realistic gentle trend
                price = base_price + (day_offset * 0.15) + ((day_offset % 7) - 3) * 0.8
                prices.append(
                    HistoricalPriceData(
                        date=cur_date,
                        open=round(price - 0.5, 2),
                        high=round(price + 1.2, 2),
                        low=round(price - 1.0, 2),
                        close=round(price, 2),
                        adjusted_close=round(price, 2),
                        volume=50000000 + (day_offset * 10000),
                        currency="USD" if "DE" not in identifier else "EUR",
                        data_source=self.provider_name,
                    )
                )
            cur_date += timedelta(days=1)

        return prices

    def get_fundamental_data(self, identifier: str) -> list[FundamentalPeriodData]:
        currency = "EUR" if "DE" in identifier or "SAP" in identifier else "USD"
        return [
            FundamentalPeriodData(
                period_type="annual",
                fiscal_year=2023,
                fiscal_period="FY",
                period_end_date=date(2023, 12, 31),
                revenue=383285000000.0,
                gross_profit=169148000000.0,
                operating_income=114301000000.0,
                net_income=96995000000.0,
                eps=6.13,
                gross_margin=0.4413,
                operating_margin=0.2982,
                net_margin=0.2531,
                operating_cash_flow=110543000000.0,
                free_cash_flow=99584000000.0,
                capital_expenditures=10959000000.0,
                total_assets=352583000000.0,
                total_equity=62146000000.0,
                total_debt=111088000000.0,
                cash_and_equivalents=29965000000.0,
                current_ratio=0.98,
                debt_to_equity=1.79,
                dividend_per_share=0.96,
                dividend_yield=0.0055,
                pe_ratio=28.5,
                ps_ratio=7.2,
                pb_ratio=42.0,
                currency=currency,
                data_source=self.provider_name,
            ),
            FundamentalPeriodData(
                period_type="annual",
                fiscal_year=2024,
                fiscal_period="FY",
                period_end_date=date(2024, 12, 31),
                revenue=391035000000.0,
                gross_profit=180683000000.0,
                operating_income=123216000000.0,
                net_income=101372000000.0,
                eps=6.61,
                gross_margin=0.4621,
                operating_margin=0.3151,
                net_margin=0.2592,
                operating_cash_flow=118254000000.0,
                free_cash_flow=108800000000.0,
                capital_expenditures=9454000000.0,
                total_assets=364980000000.0,
                total_equity=66800000000.0,
                total_debt=106000000000.0,
                cash_and_equivalents=32000000000.0,
                current_ratio=1.05,
                debt_to_equity=1.58,
                dividend_per_share=1.00,
                dividend_yield=0.0052,
                pe_ratio=31.2,
                ps_ratio=7.9,
                pb_ratio=46.5,
                currency=currency,
                data_source=self.provider_name,
            ),
        ]

    def get_company_reports(self, identifier: str) -> list[ReportDocumentData]:
        return [
            ReportDocumentData(
                report_type="ANNUAL_REPORT",
                fiscal_year=2024,
                fiscal_period="FY",
                report_date=date(2024, 11, 1),
                title="Annual Report 2024 (Form 10-K)",
                content_text=(
                    "Management Discussion and Analysis: During fiscal year 2024, revenue grew by 2% to $391.0 billion. "
                    "Gross margin expanded to 46.2%, driven by strong growth in Services and high-margin products. "
                    "Operating cash flow reached $118.3 billion, enabling increased share repurchases and dividends. "
                    "Key risks: Supply chain concentration in Asia, geopolitical tensions, regulatory scrutiny regarding app store fees, "
                    "and foreign exchange volatility. "
                    "Opportunities: Expansion of cloud services, generative AI features integrated into hardware ecosystem, and enterprise adoption."
                ),
                source_url="https://example.com/reports/2024-10k",
                data_source=self.provider_name,
            )
        ]
