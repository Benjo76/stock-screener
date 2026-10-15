""" Portfolio Aggregation and Research Analyzer """

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from screener.analysis.engine import StockAnalysisEngine
from screener.db.models import Portfolio, PortfolioHolding, StockPrice


@dataclass
class PortfolioAnalysisEvaluation:
    score: float  # 0 to 100
    headline: str
    summary: str
    total_invested_cost: float
    total_current_value: float
    total_unrealized_gain_loss: float
    total_unrealized_return_pct: float | None
    currency: str
    positions_count: int
    holdings_breakdown: list[dict[str, Any]]
    sector_allocation: dict[str, float]
    currency_allocation: dict[str, float]
    trends: list[str]
    risks: list[str]
    opportunities: list[str]
    data_gaps: list[str]
    uncertainties: list[str]
    data_sources: list[dict[str, Any]]
    data_timestamp: datetime


class PortfolioAnalyzer:
    """
    Analyzes an entire portfolio:
    - Calculates valuation, gain/loss, diversification, and sector distribution
    - Computes weighted fundamental scores from constituent stocks
    - Highlights portfolio-level risks (cluster risk, single-stock dependency, missing data)
    """

    @classmethod
    def analyze_portfolio(
        cls,
        portfolio: Portfolio,
    ) -> PortfolioAnalysisEvaluation:
        now = datetime.now()
        holdings = portfolio.holdings or []
        currency = portfolio.currency or "EUR"

        if not holdings:
            return PortfolioAnalysisEvaluation(
                score=0.0,
                headline="Depot ist leer",
                summary=f"Im Depot '{portfolio.name}' befinden sich noch keine Wertpapierbestände.",
                total_invested_cost=0.0,
                total_current_value=0.0,
                total_unrealized_gain_loss=0.0,
                total_unrealized_return_pct=None,
                currency=currency,
                positions_count=0,
                holdings_breakdown=[],
                sector_allocation={},
                currency_allocation={},
                trends=[],
                risks=["Keine Positionen im Depot vorhanden."],
                opportunities=["Füge Wertpapiere hinzu oder importiere einen CSV-Depotauszug."],
                data_gaps=[],
                uncertainties=[],
                data_sources=[],
                data_timestamp=now,
            )

        total_cost = 0.0
        total_value = 0.0
        breakdown: list[dict[str, Any]] = []
        sector_weights: dict[str, float] = {}
        currency_weights: dict[str, float] = {}
        weighted_scores_sum = 0.0
        weighted_weight_sum = 0.0
        data_gaps: list[str] = []
        uncertainties: list[str] = []
        risks: list[str] = []
        opportunities: list[str] = []
        trends: list[str] = []
        data_sources: list[dict[str, Any]] = []

        for h in holdings:
            stk = h.stock
            shares = h.shares or 0.0
            avg_price = h.average_buy_price or 0.0
            cost = h.total_cost if h.total_cost is not None else (shares * avg_price)
            total_cost += cost

            # Determine latest price
            latest_price = None
            if stk and stk.prices:
                sorted_prices = sorted(stk.prices, key=lambda p: p.date)
                latest_price = sorted_prices[-1].close
                data_sources.append({
                    "stock": stk.ticker or stk.isin,
                    "type": "price",
                    "date": str(sorted_prices[-1].date),
                    "source": sorted_prices[-1].data_source,
                })

            pos_curr_price = latest_price if latest_price is not None else avg_price
            pos_value = shares * pos_curr_price
            total_value += pos_value

            if latest_price is None and avg_price == 0.0:
                data_gaps.append(f"Kein Einstandskurs oder Marktpreis für {stk.name or stk.isin or 'Wertpapier'} vorhanden.")

            # Individual stock evaluation
            stock_eval = None
            stock_score = None
            if stk and stk.fundamentals:
                stock_eval = StockAnalysisEngine.analyze(stk, stk.fundamentals, stk.prices)
                stock_score = stock_eval.score
                weighted_scores_sum += stock_score * pos_value
                weighted_weight_sum += pos_value
            else:
                data_gaps.append(f"Keine Fundamentaldaten für Position {stk.name or stk.isin or stk.ticker if stk else 'Unbekannt'}.")

            pos_gain_loss = pos_value - cost
            pos_return_pct = (pos_gain_loss / cost) if cost > 0 else 0.0

            sec = stk.sector if stk and stk.sector else "Sonstige / Unbekannt"
            sector_weights[sec] = sector_weights.get(sec, 0.0) + pos_value

            curr = h.currency or (stk.currency if stk else currency) or currency
            currency_weights[curr] = currency_weights.get(curr, 0.0) + pos_value

            breakdown.append({
                "holding_id": h.id,
                "stock_id": stk.id if stk else None,
                "isin": stk.isin if stk else None,
                "wkn": stk.wkn if stk else None,
                "ticker": stk.ticker if stk else None,
                "name": stk.name if stk else None,
                "sector": sec,
                "shares": shares,
                "average_buy_price": avg_price,
                "latest_price": latest_price,
                "total_cost": cost,
                "current_value": pos_value,
                "unrealized_gain_loss": pos_gain_loss,
                "unrealized_return_pct": pos_return_pct,
                "fundamental_score": stock_score,
                "currency": curr,
            })

        # Calculate percentages
        if total_value > 0:
            for item in breakdown:
                item["weight_pct"] = round((item["current_value"] / total_value) * 100, 2)
            sector_allocation = {k: round((v / total_value) * 100, 2) for k, v in sector_weights.items()}
            currency_allocation = {k: round((v / total_value) * 100, 2) for k, v in currency_weights.items()}
        else:
            for item in breakdown:
                item["weight_pct"] = 0.0
            sector_allocation = {}
            currency_allocation = {}

        unrealized_gl = total_value - total_cost
        unrealized_pct = (unrealized_gl / total_cost) if total_cost > 0 else None

        # Check concentration risk
        top_positions = sorted(breakdown, key=lambda x: x["current_value"], reverse=True)
        if top_positions and top_positions[0]["weight_pct"] > 35.0:
            risks.append(f"Hohes Klumpenrisiko: '{top_positions[0]['name'] or top_positions[0]['ticker']}' macht {top_positions[0]['weight_pct']}% des Portfoliowerts aus.")
        elif top_positions and top_positions[0]["weight_pct"] > 20.0:
            trends.append(f"Größte Position '{top_positions[0]['name'] or top_positions[0]['ticker']}' mit {top_positions[0]['weight_pct']}% Gewichtung.")

        if len(breakdown) < 5:
            risks.append(f"Geringe Diversifikation ({len(breakdown)} Positionen).")
        else:
            opportunities.append(f"Breite Streuung über {len(breakdown)} Positionen.")

        # Top sector check
        if sector_allocation:
            top_sector, top_sector_pct = max(sector_allocation.items(), key=lambda x: x[1])
            if top_sector_pct > 50.0:
                risks.append(f"Sektorklumpen: {top_sector} umfasst {top_sector_pct}% des Depots.")
            else:
                trends.append(f"Größter Sektor: {top_sector} ({top_sector_pct}%).")

        # Portfolio fundamental score
        if weighted_weight_sum > 0:
            avg_fundamental_score = round(weighted_scores_sum / weighted_weight_sum, 1)
        else:
            avg_fundamental_score = 50.0
            uncertainties.append("Durchschnittlicher Fundamental-Score konnte mangels Fundamentaldaten nur geschätzt werden.")

        total_score = avg_fundamental_score
        if len(breakdown) >= 5:
            total_score = min(100.0, total_score + 5.0)

        headline = f"Depot-Analyse '{portfolio.name}': {len(breakdown)} Positionen, Gesamtwert {total_value:,.2f} {currency}"
        summary = (
            f"Depot '{portfolio.name}' mit Gesamtwert von {total_value:,.2f} {currency} (Einstand: {total_cost:,.2f} {currency}). "
            f"Unrealisiertes Ergebnis: {unrealized_gl:+,.2f} {currency} "
            f"({unrealized_pct*100:+.2f}%). "
            f"Durchschnittlicher fundamentaler Qualitäts-Score: {avg_fundamental_score}/100."
        )

        return PortfolioAnalysisEvaluation(
            score=total_score,
            headline=headline,
            summary=summary,
            total_invested_cost=round(total_cost, 2),
            total_current_value=round(total_value, 2),
            total_unrealized_gain_loss=round(unrealized_gl, 2),
            total_unrealized_return_pct=round(unrealized_pct, 4) if unrealized_pct is not None else None,
            currency=currency,
            positions_count=len(breakdown),
            holdings_breakdown=breakdown,
            sector_allocation=sector_allocation,
            currency_allocation=currency_allocation,
            trends=trends,
            risks=risks,
            opportunities=opportunities,
            data_gaps=data_gaps,
            uncertainties=uncertainties,
            data_sources=data_sources,
            data_timestamp=now,
        )
