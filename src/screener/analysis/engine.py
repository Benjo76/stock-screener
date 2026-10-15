"""Fundamental Stock Analysis Engine"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from screener.db.models.stock import FundamentalData, Stock, StockPrice


@dataclass
class StockAnalysisEvaluation:
    score: float  # 0 to 100
    headline: str
    summary: str
    growth_score: float
    profitability_score: float
    stability_score: float
    valuation_score: float
    metrics: dict[str, Any]
    trends: list[str]
    risks: list[str]
    opportunities: list[str]
    data_gaps: list[str]
    uncertainties: list[str]
    data_sources: list[dict[str, Any]]
    data_timestamp: datetime


class StockAnalysisEngine:
    """
    Rule-based fundamental stock analysis engine.
    Computes financial stability, profitability, growth, valuation, and risks/opportunities.
    Transparently tracks missing data vs negative numbers.
    """

    INDUSTRY_PROFILES = {
        "Technology": {"max_debt_to_equity": 1.5, "min_operating_margin": 0.15, "typical_pe": 28.0},
        "Software": {"max_debt_to_equity": 1.0, "min_operating_margin": 0.20, "typical_pe": 32.0},
        "Financial Services": {"max_debt_to_equity": 5.0, "min_operating_margin": 0.25, "typical_pe": 13.0},
        "Consumer Cyclical": {"max_debt_to_equity": 2.0, "min_operating_margin": 0.08, "typical_pe": 20.0},
        "Healthcare": {"max_debt_to_equity": 1.8, "min_operating_margin": 0.12, "typical_pe": 22.0},
        "Industrials": {"max_debt_to_equity": 2.2, "min_operating_margin": 0.08, "typical_pe": 18.0},
        "Utilities": {"max_debt_to_equity": 3.0, "min_operating_margin": 0.12, "typical_pe": 16.0},
    }

    @classmethod
    def analyze(
        cls,
        stock: Stock,
        fundamentals: list[FundamentalData],
        prices: list[StockPrice] | None = None,
    ) -> StockAnalysisEvaluation:
        data_gaps: list[str] = []
        uncertainties: list[str] = []
        trends: list[str] = []
        risks: list[str] = []
        opportunities: list[str] = []
        data_sources: list[dict[str, Any]] = []

        now = datetime.now()

        if not fundamentals:
            name_ident = stock.name or stock.isin or stock.ticker
            return StockAnalysisEvaluation(
                score=0.0,
                headline="Keine Fundamentaldaten verfügbar",
                summary=f"Für {name_ident} liegen keine historischen Fundamentaldaten vor.",
                growth_score=0.0,
                profitability_score=0.0,
                stability_score=0.0,
                valuation_score=0.0,
                metrics={},
                trends=[],
                risks=["Fehlende Fundamentaldaten verunmöglichen eine fundierte Bewertung."],
                opportunities=[],
                data_gaps=["Vollständige Bilanz- und GuV-Daten fehlen."],
                uncertainties=["Keine verlässliche Analyse ohne Primärdaten."],
                data_sources=[],
                data_timestamp=now,
            )

        # Sort fundamentals by year/period ascending
        sorted_fundamentals = sorted(
            fundamentals,
            key=lambda f: (
                f.fiscal_year or 0,
                f.fiscal_period or "",
                f.period_end_date or f.created_at.date() if f.created_at else now.date(),
            ),
        )
        latest = sorted_fundamentals[-1]
        previous = sorted_fundamentals[-2] if len(sorted_fundamentals) > 1 else None

        # Collect data sources info
        for f in sorted_fundamentals:
            data_sources.append(
                {
                    "type": "fundamental",
                    "source": f.data_source,
                    "period": f"{f.fiscal_year or ''} {f.fiscal_period or f.period_type}",
                    "recorded_at": f.created_at.isoformat() if f.created_at else now.isoformat(),
                }
            )

        # Industry profile adjustments
        sector = stock.sector or "Technology"
        industry_cfg = cls.INDUSTRY_PROFILES.get(
            sector, {"max_debt_to_equity": 2.0, "min_operating_margin": 0.10, "typical_pe": 20.0}
        )

        # 1. Growth Analysis
        growth_points = 0.0
        growth_max = 25.0
        rev_growth = None
        net_inc_growth = None
        eps_growth = None

        if previous and latest.revenue is not None and previous.revenue is not None and previous.revenue > 0:
            rev_growth = (latest.revenue - previous.revenue) / previous.revenue
            if rev_growth > 0.15:
                growth_points += 10.0
                trends.append(f"Starkes Umsatzwachstum von {rev_growth*100:.1f}% gegenüber Vorperiode.")
                opportunities.append("Expansives Umsatzwachstum signalisiert hohe Marktnachfrage.")
            elif rev_growth > 0.03:
                growth_points += 7.0
                trends.append(f"Solides Umsatzwachstum von {rev_growth*100:.1f}%.")
            elif rev_growth >= 0:
                growth_points += 4.0
                trends.append(f"Stagnierendes Umsatzwachstum von {rev_growth*100:.1f}%.")
            else:
                growth_points += 0.0
                trends.append(f"Umsatzrückgang um {abs(rev_growth)*100:.1f}%.")
                risks.append("Umsatzschrumpfung im Vorjahresvergleich.")
        elif latest.revenue is None:
            data_gaps.append("Umsatzdaten (Revenue) nicht verfügbar.")
        else:
            uncertainties.append("Nur eine Berichtsperiode für Umsatzwachstumsberechnung vorhanden.")
            growth_points += 5.0

        if previous and latest.net_income is not None and previous.net_income is not None and previous.net_income > 0:
            net_inc_growth = (latest.net_income - previous.net_income) / previous.net_income
            if net_inc_growth > 0.10:
                growth_points += 8.0
                trends.append(f"Gewinnwachstum (Net Income) um {net_inc_growth*100:.1f}%.")
            elif net_inc_growth >= 0:
                growth_points += 5.0
            else:
                risks.append("Rückläufiger Nettogewinn gegenüber Vorperiode.")
        elif latest.net_income is None:
            data_gaps.append("Jahresüberschuss (Net Income) nicht verfügbar.")

        if previous and latest.eps is not None and previous.eps is not None and previous.eps > 0:
            eps_growth = (latest.eps - previous.eps) / previous.eps
            if eps_growth > 0.08:
                growth_points += 7.0
            elif eps_growth >= 0:
                growth_points += 4.0
        elif latest.eps is None:
            data_gaps.append("Gewinn je Aktie (EPS) nicht angegeben.")

        # 2. Profitability & Margins
        prof_points = 0.0
        prof_max = 25.0

        if latest.gross_margin is not None:
            if latest.gross_margin >= 0.40:
                prof_points += 8.0
                trends.append(f"Hohe Bruttomarge von {latest.gross_margin*100:.1f}%.")
                opportunities.append("Hohe Preissetzungsmacht durch starke Bruttomarge.")
            elif latest.gross_margin >= 0.20:
                prof_points += 5.0
            elif latest.gross_margin > 0:
                prof_points += 2.0
            else:
                risks.append("Negative oder kritisch niedrige Bruttomarge.")
        else:
            data_gaps.append("Bruttomarge (Gross Margin) nicht ausgewiesen.")

        if latest.operating_margin is not None:
            if latest.operating_margin >= industry_cfg["min_operating_margin"]:
                prof_points += 9.0
                trends.append(f"Überdurchschnittliche operative Marge von {latest.operating_margin*100:.1f}%.")
            elif latest.operating_margin > 0:
                prof_points += 5.0
            else:
                risks.append("Operativer Verlust (negative operative Marge).")
        elif latest.operating_income is not None and latest.revenue:
            op_m = latest.operating_income / latest.revenue
            if op_m > 0:
                prof_points += 5.0
        else:
            data_gaps.append("Operatives Ergebnis / operative Marge fehlt.")

        # Free Cashflow Profitability
        if latest.free_cash_flow is not None:
            if latest.free_cash_flow > 0:
                prof_points += 8.0
                trends.append("Positiver Free Cashflow unterstützt finanzielle Flexibilität.")
                opportunities.append(
                    "Starker Free Cashflow ermöglicht Dividenden, Aktienrückkäufe oder Reinvestitionen."
                )
            else:
                risks.append("Negativer Free Cashflow (Cash-Burn).")
        elif latest.operating_cash_flow is not None:
            if latest.operating_cash_flow > 0:
                prof_points += 5.0
            else:
                risks.append("Negativer operativer Cashflow.")
        else:
            data_gaps.append("Cashflow-Daten (Operating & Free Cashflow) nicht vorhanden.")

        # 3. Financial Stability & Balance Sheet
        stab_points = 0.0
        stab_max = 25.0

        if latest.debt_to_equity is not None:
            if latest.debt_to_equity <= industry_cfg["max_debt_to_equity"] * 0.7:
                stab_points += 10.0
                trends.append(f"Solide Verschuldungsquote (Debt/Equity: {latest.debt_to_equity:.2f}).")
            elif latest.debt_to_equity <= industry_cfg["max_debt_to_equity"]:
                stab_points += 6.0
            else:
                max_de = industry_cfg["max_debt_to_equity"]
                risks.append(
                    f"Erhöhte Verschuldung (Debt/Equity: {latest.debt_to_equity:.2f} > Branchenwert {max_de})."
                )
        elif latest.total_debt is not None and latest.cash_and_equivalents is not None:
            net_debt = latest.total_debt - latest.cash_and_equivalents
            if net_debt <= 0:
                stab_points += 10.0
                opportunities.append("Netto-Cash-Position (Barmittel übersteigen Gesamtverschuldung).")
            else:
                stab_points += 5.0
        else:
            data_gaps.append("Verschuldungsgrad / Debt-to-Equity nicht vollständig verfügbar.")

        if latest.current_ratio is not None:
            if latest.current_ratio >= 1.5:
                stab_points += 8.0
                trends.append(f"Gute kurzfristige Liquidität (Current Ratio: {latest.current_ratio:.2f}).")
            elif latest.current_ratio >= 1.0:
                stab_points += 5.0
            else:
                risks.append(f"Kurzfristige Liquiditätsanspannung (Current Ratio: {latest.current_ratio:.2f} < 1.0).")
        else:
            data_gaps.append("Current Ratio (Liquiditätskennzahl) fehlt.")

        if latest.cash_and_equivalents is not None and latest.cash_and_equivalents > 0:
            stab_points += 7.0
        else:
            uncertainties.append("Barmittelbestand nicht explizit ausgewiesen.")

        # 4. Valuation & Multiples
        val_points = 0.0
        val_max = 25.0

        if latest.pe_ratio is not None:
            if latest.pe_ratio > 0:
                if latest.pe_ratio <= industry_cfg["typical_pe"] * 0.8:
                    val_points += 12.0
                    typ_pe = industry_cfg["typical_pe"]
                    opportunities.append(
                        f"Günstige KGV-Bewertung ({latest.pe_ratio:.1f} vs Branchen-Richtwert {typ_pe})."
                    )
                elif latest.pe_ratio <= industry_cfg["typical_pe"] * 1.3:
                    val_points += 8.0
                    trends.append(f"Faire KGV-Bewertung ({latest.pe_ratio:.1f}).")
                else:
                    val_points += 3.0
                    risks.append(
                        f"Ambitionierte KGV-Bewertung ({latest.pe_ratio:.1f}). Hohe Wachstumserwartungen eingepreist."
                    )
            else:
                risks.append("Negatives KGV aufgrund von Verlusten.")
        else:
            data_gaps.append("KGV (P/E Ratio) nicht verfügbar.")
            val_points += 4.0

        if latest.ps_ratio is not None:
            if 0 < latest.ps_ratio <= 4.0:
                val_points += 7.0
            elif latest.ps_ratio > 4.0:
                val_points += 3.0
        elif latest.pb_ratio is not None:
            if 0 < latest.pb_ratio <= 3.0:
                val_points += 5.0

        if latest.dividend_yield is not None and latest.dividend_yield > 0:
            val_points += 6.0
            trends.append(f"Ausschüttungsrendite von {latest.dividend_yield*100:.2f}%.")
            opportunities.append("Regelmäßige Dividendenzahlungen unterstützen Gesamtrendite.")

        # Aggregate total score (0 to 100)
        total_score = round(growth_points + prof_points + stab_points + val_points, 1)

        # Build headline and summary
        if total_score >= 75:
            headline = f"Hervorragendes fundamentales Profil ({total_score}/100)"
        elif total_score >= 55:
            headline = f"Solides fundamentales Profil ({total_score}/100)"
        elif total_score >= 40:
            headline = f"Gemischtes fundamentales Profil ({total_score}/100)"
        else:
            headline = f"Kritisches oder risikoreiches Profil ({total_score}/100)"

        summary_parts = [
            f"Analyse für {stock.name or stock.ticker or stock.isin} (Sektor: {sector}).",
            (
                f"Wachstum: {growth_points:.1f}/{growth_max}, "
                f"Rentabilität: {prof_points:.1f}/{prof_max}, "
                f"Stabilität: {stab_points:.1f}/{stab_max}, "
                f"Bewertung: {val_points:.1f}/{val_max}."
            ),
        ]
        if risks:
            summary_parts.append(f"Hauptrisiken: {'; '.join(risks[:2])}")
        if opportunities:
            summary_parts.append(f"Chancen: {'; '.join(opportunities[:2])}")

        metrics = {
            "period": f"{latest.fiscal_year or ''} {latest.fiscal_period or latest.period_type}",
            "currency": latest.currency,
            "revenue": latest.revenue,
            "revenue_growth_yoy": rev_growth,
            "net_income": latest.net_income,
            "net_income_growth_yoy": net_inc_growth,
            "eps": latest.eps,
            "eps_growth_yoy": eps_growth,
            "gross_margin": latest.gross_margin,
            "operating_margin": latest.operating_margin,
            "operating_cash_flow": latest.operating_cash_flow,
            "free_cash_flow": latest.free_cash_flow,
            "debt_to_equity": latest.debt_to_equity,
            "current_ratio": latest.current_ratio,
            "pe_ratio": latest.pe_ratio,
            "ps_ratio": latest.ps_ratio,
            "pb_ratio": latest.pb_ratio,
            "dividend_yield": latest.dividend_yield,
        }

        return StockAnalysisEvaluation(
            score=total_score,
            headline=headline,
            summary=" ".join(summary_parts),
            growth_score=growth_points,
            profitability_score=prof_points,
            stability_score=stab_points,
            valuation_score=val_points,
            metrics=metrics,
            trends=trends,
            risks=risks,
            opportunities=opportunities,
            data_gaps=data_gaps,
            uncertainties=uncertainties,
            data_sources=data_sources,
            data_timestamp=now,
        )
