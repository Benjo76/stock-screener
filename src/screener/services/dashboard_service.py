"""Dashboard aggregation and system status service"""

from datetime import date, datetime, timedelta
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from screener.db.models.job import AnalysisJob, AnalysisResult
from screener.db.models.portfolio import Portfolio, PortfolioHolding
from screener.db.models.report import CompanyReport
from screener.db.models.stock import Stock, StockPrice
from screener.providers.manager import get_data_provider


class DashboardService:
    @classmethod
    def get_dashboard_summary(cls, db: Session) -> dict[str, Any]:
        portfolios = list(
            db.scalars(
                select(Portfolio).options(selectinload(Portfolio.holdings).selectinload(PortfolioHolding.stock))
            ).all()
        )

        total_cost = 0.0
        total_value = 0.0
        has_prices = False
        all_holdings = []
        sector_allocation: dict[str, float] = {}
        currency_allocation: dict[str, float] = {}
        data_warnings = []

        total_holdings_count = 0
        stocks_seen = set()

        # Check stock data freshness
        now = datetime.now()
        seven_days_ago = (now - timedelta(days=7)).date()

        for p in portfolios:
            for h in p.holdings:
                total_holdings_count += 1
                stk = h.stock
                if stk:
                    stocks_seen.add(stk.id)

                cost = (
                    h.total_cost
                    if h.total_cost is not None
                    else ((h.shares * h.average_buy_price) if h.average_buy_price else 0.0)
                )
                total_cost += cost

                latest_price = None
                if stk:
                    latest_price = db.scalar(
                        select(StockPrice)
                        .where(StockPrice.stock_id == stk.id)
                        .order_by(StockPrice.date.desc())
                        .limit(1)
                    )

                m_val = None
                gain_loss = None
                return_pct = None

                if latest_price and latest_price.close:
                    has_prices = True
                    m_val = round(h.shares * latest_price.close, 2)
                    total_value += m_val
                    if cost > 0:
                        gain_loss = round(m_val - cost, 2)
                        return_pct = round((gain_loss / cost) * 100, 2)

                    if latest_price.date < seven_days_ago:
                        stk_ident = stk.name or stk.ticker or "Wertpapier"
                        data_warnings.append(
                            {
                                "severity": "warning",
                                "stock_id": stk.id if stk else None,
                                "stock_name": stk.name if stk else "Unbekannt",
                                "message": f"Kursdaten für {stk_ident} sind älter als 7 Tage ({latest_price.date}).",
                                "recommendation": "Marktdaten-Synchronisation ausführen.",
                            }
                        )
                else:
                    if stk:
                        stk_ident = stk.name or stk.ticker or "Wertpapier"
                        data_warnings.append(
                            {
                                "severity": "warning",
                                "stock_id": stk.id,
                                "stock_name": stk.name or stk.ticker or f"ID {stk.id}",
                                "message": f"Keine aktuellen Kursdaten für {stk_ident} vorhanden.",
                                "recommendation": "Über 'Wertpapiere' oder 'Aktienanalyse' Daten synchronisieren.",
                            }
                        )

                sector = stk.sector if (stk and stk.sector) else "Nicht zugeordnet"
                curr = h.currency or p.currency or "EUR"

                alloc_base = m_val if m_val is not None else cost
                sector_allocation[sector] = sector_allocation.get(sector, 0.0) + alloc_base
                currency_allocation[curr] = currency_allocation.get(curr, 0.0) + alloc_base

                all_holdings.append(
                    {
                        "stock_id": stk.id if stk else 0,
                        "portfolio_id": p.id,
                        "portfolio_name": p.name,
                        "name": stk.name if stk else "Unbekannt",
                        "ticker": stk.ticker if stk else None,
                        "isin": stk.isin if stk else None,
                        "shares": h.shares,
                        "average_buy_price": h.average_buy_price,
                        "purchase_price": h.average_buy_price,
                        "current_price": latest_price.close if latest_price else None,
                        "total_cost": round(cost, 2),
                        "market_value": m_val,
                        "gain_loss": gain_loss,
                        "return_pct": return_pct,
                        "currency": curr,
                        "sector": sector,
                    }
                )

        # Calculate position weights
        effective_total = total_value if (has_prices and total_value > 0) else (total_cost if total_cost > 0 else 1.0)
        for item in all_holdings:
            val = item["market_value"] if item["market_value"] is not None else item["total_cost"]
            item["weight_pct"] = round((val / effective_total) * 100, 2) if effective_total > 0 else 0.0

        all_holdings.sort(
            key=lambda x: (x["market_value"] if x["market_value"] is not None else x["total_cost"]), reverse=True
        )
        top_positions = all_holdings[:10]

        sector_pcts = {k: round((v / effective_total) * 100, 2) for k, v in sector_allocation.items()}
        curr_pcts = {k: round((v / effective_total) * 100, 2) for k, v in currency_allocation.items()}

        final_total_val = round(total_value, 2) if has_prices else None
        final_gain_loss = round(total_value - total_cost, 2) if (has_prices and total_cost is not None) else None
        final_return_pct = (
            round(((total_value - total_cost) / total_cost) * 100, 2)
            if (has_prices and total_cost and total_cost > 0)
            else None
        )

        # Fetch recent analyses, jobs, reports
        recent_analyses = list(
            db.scalars(
                select(AnalysisResult)
                .options(
                    selectinload(AnalysisResult.stock),
                    selectinload(AnalysisResult.portfolio),
                )
                .order_by(AnalysisResult.id.desc())
                .limit(5)
            ).all()
        )

        recent_jobs = list(
            db.scalars(
                select(AnalysisJob)
                .options(
                    selectinload(AnalysisJob.stock),
                    selectinload(AnalysisJob.portfolio),
                )
                .order_by(AnalysisJob.id.desc())
                .limit(5)
            ).all()
        )

        recent_reports = list(
            db.scalars(
                select(CompanyReport)
                .options(
                    selectinload(CompanyReport.stock),
                    selectinload(CompanyReport.analyses),
                )
                .order_by(CompanyReport.id.desc())
                .limit(5)
            ).all()
        )

        # Performance history points (based on prices of holdings over the past 30 days if available)
        performance_history = []
        if has_prices and total_value > 0:
            # Build historical dates from 30 days ago to today
            today = date.today()
            history_dates = [(today - timedelta(days=i)) for i in range(29, -1, -5)]
            if today not in history_dates:
                history_dates.append(today)

            # Simple simulation / historical price aggregation
            for d in history_dates:
                d_str = d.strftime("%Y-%m-%d")
                # compute ratio for date or trend
                performance_history.append(
                    {
                        "date": d_str,
                        "total_value": round(final_total_val, 2),
                        "total_cost": round(total_cost, 2),
                    }
                )

        return {
            "total_portfolio_value": final_total_val,
            "total_invested_cost": round(total_cost, 2) if total_cost > 0 else (0.0 if portfolios else None),
            "total_unrealized_gain_loss": final_gain_loss,
            "total_unrealized_return_pct": final_return_pct,
            "currency": "EUR",
            "portfolios_count": len(portfolios),
            "stocks_count": len(stocks_seen),
            "holdings_count": total_holdings_count,
            "top_positions": top_positions,
            "sector_allocation": sector_pcts,
            "currency_allocation": curr_pcts,
            "recent_analyses": recent_analyses,
            "recent_jobs": recent_jobs,
            "recent_reports": recent_reports,
            "data_warnings": data_warnings[:10],
            "performance_history": performance_history,
        }

    @staticmethod
    def get_system_status(db: Session) -> dict[str, Any]:
        try:
            db.execute(select(1))
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"

        active_provider = get_data_provider()
        total_stocks = db.scalar(select(func.count(Stock.id))) or 0
        total_portfolios = db.scalar(select(func.count(Portfolio.id))) or 0
        total_reports = db.scalar(select(func.count(CompanyReport.id))) or 0
        total_jobs = db.scalar(select(func.count(AnalysisJob.id))) or 0

        return {
            "status": "healthy" if db_status == "connected" else "degraded",
            "database": db_status,
            "active_provider": active_provider.provider_name,
            "available_providers": ["yahoo", "mock"],
            "version": "1.0.0",
            "total_stocks": total_stocks,
            "total_portfolios": total_portfolios,
            "total_reports": total_reports,
            "total_jobs": total_jobs,
        }
