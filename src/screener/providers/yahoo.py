""" Free Yahoo Finance / Open market data provider using HTTP requests """

import logging
from datetime import date, datetime
from typing import Any

import httpx

from screener.providers.base import (
    BaseDataProvider,
    FundamentalPeriodData,
    HistoricalPriceData,
    ReportDocumentData,
    StockProfile,
)

logger = logging.getLogger(__name__)


class YahooFinanceProvider(BaseDataProvider):
    """
    Public Yahoo Finance provider using open query endpoints.
    Requires no paid API keys.
    """

    USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

    @property
    def provider_name(self) -> str:
        return "yahoo_finance"

    def _get_headers(self) -> dict[str, str]:
        return {
            "User-Agent": self.USER_AGENT,
            "Accept": "application/json",
        }

    def lookup_stock(self, identifier: str) -> StockProfile | None:
        ident = identifier.strip().upper()
        # Search API
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={ident}&quotesCount=5&newsCount=0"
        try:
            with httpx.Client(timeout=10.0, headers=self._get_headers()) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    quotes = data.get("quotes", [])
                    if quotes:
                        q = quotes[0]
                        symbol = q.get("symbol", ident)
                        name = q.get("shortname") or q.get("longname")
                        exchange = q.get("exchange")
                        sector = q.get("sector")
                        industry = q.get("industry")
                        isin = ident if len(ident) == 12 and ident[:2].isalpha() else None
                        wkn = ident if len(ident) == 6 else None
                        return StockProfile(
                            symbol=symbol,
                            name=name,
                            isin=isin,
                            wkn=wkn,
                            exchange=exchange,
                            sector=sector,
                            industry=industry,
                        )
        except Exception as e:
            logger.warning(f"YahooFinance lookup failed for {identifier}: {e}")
        return None

    def get_historical_prices(
        self,
        identifier: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[HistoricalPriceData]:
        symbol = identifier.strip().upper()
        # Yahoo Finance v8 chart endpoint
        start_ts = int(datetime.combine(start_date, datetime.min.time()).timestamp()) if start_date else 0
        end_ts = int(datetime.combine(end_date, datetime.max.time()).timestamp()) if end_date else int(datetime.now().timestamp())
        
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?period1={start_ts}&period2={end_ts}&interval=1d"
        results: list[HistoricalPriceData] = []

        try:
            with httpx.Client(timeout=10.0, headers=self._get_headers()) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    chart = data.get("chart", {}).get("result", [])
                    if chart:
                        result = chart[0]
                        meta = result.get("meta", {})
                        currency = meta.get("currency", "USD")
                        timestamps = result.get("timestamp", [])
                        indicators = result.get("indicators", {}).get("quote", [{}])[0]
                        adjclose_list = result.get("indicators", {}).get("adjclose", [{}])[0].get("adjclose", [])

                        opens = indicators.get("open", [])
                        highs = indicators.get("high", [])
                        lows = indicators.get("low", [])
                        closes = indicators.get("close", [])
                        volumes = indicators.get("volume", [])

                        for i, ts in enumerate(timestamps):
                            if i < len(closes) and closes[i] is not None:
                                price_date = datetime.fromtimestamp(ts).date()
                                results.append(
                                    HistoricalPriceData(
                                        date=price_date,
                                        open=round(opens[i], 2) if i < len(opens) and opens[i] is not None else None,
                                        high=round(highs[i], 2) if i < len(highs) and highs[i] is not None else None,
                                        low=round(lows[i], 2) if i < len(lows) and lows[i] is not None else None,
                                        close=round(closes[i], 2),
                                        adjusted_close=round(adjclose_list[i], 2) if i < len(adjclose_list) and adjclose_list[i] is not None else None,
                                        volume=int(volumes[i]) if i < len(volumes) and volumes[i] is not None else None,
                                        currency=currency,
                                        data_source=self.provider_name,
                                    )
                                )
        except Exception as e:
            logger.warning(f"YahooFinance historical prices failed for {identifier}: {e}")

        return results

    def get_fundamental_data(self, identifier: str) -> list[FundamentalPeriodData]:
        # Free Yahoo quote summary endpoint
        symbol = identifier.strip().upper()
        url = f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}?modules=financialData,defaultKeyStatistics,summaryDetail"
        fundamentals: list[FundamentalPeriodData] = []

        try:
            with httpx.Client(timeout=10.0, headers=self._get_headers()) as client:
                resp = client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    summary = data.get("quoteSummary", {}).get("result", [])
                    if summary:
                        res = summary[0]
                        fin = res.get("financialData", {})
                        stats = res.get("defaultKeyStatistics", {})
                        detail = res.get("summaryDetail", {})

                        revenue = fin.get("totalRevenue", {}).get("raw")
                        gross_margin = fin.get("grossMargins", {}).get("raw")
                        operating_margin = fin.get("operatingMargins", {}).get("raw")
                        ebitda = fin.get("ebitda", {}).get("raw")
                        net_income = fin.get("netIncomeToCommon", {}).get("raw")
                        eps = stats.get("trailingEps", {}).get("raw")
                        op_cash_flow = fin.get("operatingCashflow", {}).get("raw")
                        free_cash_flow = fin.get("freeCashflow", {}).get("raw")
                        total_debt = fin.get("totalDebt", {}).get("raw")
                        cash = fin.get("totalCash", {}).get("raw")
                        current_ratio = fin.get("currentRatio", {}).get("raw")
                        debt_to_equity = fin.get("debtToEquity", {}).get("raw")
                        div_rate = detail.get("dividendRate", {}).get("raw")
                        div_yield = detail.get("dividendYield", {}).get("raw")
                        pe_ratio = detail.get("trailingPE", {}).get("raw") or stats.get("forwardPE", {}).get("raw")
                        ps_ratio = detail.get("priceToSalesTrailing12Months", {}).get("raw")
                        pb_ratio = stats.get("priceToBook", {}).get("raw")
                        currency = fin.get("financialCurrency") or detail.get("currency") or "USD"

                        fundamentals.append(
                            FundamentalPeriodData(
                                period_type="ttm",
                                fiscal_year=datetime.now().year,
                                fiscal_period="TTM",
                                period_end_date=date.today(),
                                revenue=revenue,
                                gross_profit=round(revenue * gross_margin, 2) if revenue and gross_margin else None,
                                operating_income=round(revenue * operating_margin, 2) if revenue and operating_margin else None,
                                net_income=net_income,
                                eps=eps,
                                gross_margin=gross_margin,
                                operating_margin=operating_margin,
                                operating_cash_flow=op_cash_flow,
                                free_cash_flow=free_cash_flow,
                                total_debt=total_debt,
                                cash_and_equivalents=cash,
                                current_ratio=current_ratio,
                                debt_to_equity=round(debt_to_equity / 100.0, 2) if debt_to_equity else None,
                                dividend_per_share=div_rate,
                                dividend_yield=div_yield,
                                pe_ratio=pe_ratio,
                                ps_ratio=ps_ratio,
                                pb_ratio=pb_ratio,
                                currency=currency,
                                data_source=self.provider_name,
                                raw_data={"financialData": fin, "defaultKeyStatistics": stats},
                            )
                        )
        except Exception as e:
            logger.warning(f"YahooFinance fundamentals failed for {identifier}: {e}")

        return fundamentals

    def get_company_reports(self, identifier: str) -> list[ReportDocumentData]:
        # Free Yahoo does not supply full PDF/text annual reports, return empty list
        return []
