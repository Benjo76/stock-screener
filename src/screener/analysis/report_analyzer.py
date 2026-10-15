""" Company Report and Earnings Releases Analyzer """

import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from screener.db.models.report import CompanyReport
from screener.db.models.stock import FundamentalData


@dataclass
class ReportAnalysisResultData:
    summary: str
    extracted_kpis: dict[str, Any]
    extracted_statements: list[str]
    identified_trends: list[str]
    risks: list[str]
    opportunities: list[str]
    is_verified: bool = False
    verification_notes: str | None = None
    historical_comparison: dict[str, Any] = field(default_factory=dict)


class CompanyReportAnalyzer:
    """
    Extracts key figures, guidance, trends, risks, and opportunities from company reports.
    Always marks automatically extracted data as unverified (ungeprüft) by default.
    """

    @classmethod
    def analyze_report(
        cls,
        report: CompanyReport,
        historical_fundamentals: list[FundamentalData] | None = None,
    ) -> ReportAnalysisResultData:
        text = report.content_text or ""
        extracted_kpis: dict[str, Any] = {}
        extracted_statements: list[str] = []
        identified_trends: list[str] = []
        risks: list[str] = []
        opportunities: list[str] = []

        # 1. Regex KPI extraction heuristics
        # Revenue patterns
        rev_match = re.search(r"(?:revenue|umsatz|sales)\s*(?:grew|increased|reached|war|von|of)?\s*(?:by|to|um)?\s*[\$€]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(billion|milliarden|million|millionen|mrd|mio|b|m)?", text, re.IGNORECASE)
        if rev_match:
            num = float(rev_match.group(1).replace(",", "."))
            unit = (rev_match.group(2) or "").lower()
            if unit in ["billion", "milliarden", "mrd", "b"]:
                num *= 1_000_000_000
            elif unit in ["million", "millionen", "mio", "m"]:
                num *= 1_000_000
            extracted_kpis["extracted_revenue"] = num
            extracted_kpis["revenue_raw_match"] = rev_match.group(0)

        # Margin patterns
        margin_match = re.search(r"(?:gross margin|bruttomarge|operating margin|operative marge)\s*(?:of|war|reached)?\s*([0-9]+(?:[\.,][0-9]+)?)\s*%", text, re.IGNORECASE)
        if margin_match:
            margin_pct = float(margin_match.group(1).replace(",", ".")) / 100.0
            extracted_kpis["extracted_margin"] = margin_pct
            extracted_kpis["margin_raw_match"] = margin_match.group(0)

        # Cashflow patterns
        cf_match = re.search(r"(?:cash flow|cashflow|operativer cashflow)\s*(?:reached|of|erzielte)?\s*[\$€]?\s*([0-9]+(?:[\.,][0-9]+)?)\s*(billion|milliarden|million|millionen|mrd|mio|b|m)?", text, re.IGNORECASE)
        if cf_match:
            num = float(cf_match.group(1).replace(",", "."))
            unit = (cf_match.group(2) or "").lower()
            if unit in ["billion", "milliarden", "mrd", "b"]:
                num *= 1_000_000_000
            elif unit in ["million", "millionen", "mio", "m"]:
                num *= 1_000_000
            extracted_kpis["extracted_cashflow"] = num

        # 2. Risk and Opportunity Keyword Extraction
        risk_keywords = ["risk", "risiko", "risiken", "challenge", "uncertainty", "supply chain", "geopolitical", "litigation", "headwind", "inflation", "tariff", "competition", "decline", "slowdown"]
        opp_keywords = ["opportunity", "chance", "growth", "expansion", "cloud", "ai", "innovation", "demand", "tailwinds", "efficiency", "dividend", "repurchase"]

        sentences = re.split(r"(?<=[.!?])\s+", text)
        for s in sentences:
            s_clean = s.strip()
            if len(s_clean) < 15:
                continue
            s_lower = s_clean.lower()
            
            # Risks
            if any(k in s_lower for k in risk_keywords):
                if len(risks) < 5 and s_clean not in risks:
                    risks.append(s_clean)

            # Opportunities
            if any(k in s_lower for k in opp_keywords):
                if len(opportunities) < 5 and s_clean not in opportunities:
                    opportunities.append(s_clean)

            # Guidance / statements
            if any(w in s_lower for w in ["guidance", "prognose", "outlook", "ausblick", "management expects", "wir erwarten"]):
                if len(extracted_statements) < 5 and s_clean not in extracted_statements:
                    extracted_statements.append(s_clean)

        # Trends
        if "increased" in text.lower() or "growth" in text.lower() or "stieg" in text.lower():
            identified_trends.append("Wachstumstrend im Bericht hervorgehoben.")
        if "cost reduction" in text.lower() or "kostensenkung" in text.lower() or "efficiency" in text.lower():
            identified_trends.append("Fokus auf Kostendisziplin und Effizienzsteigerung.")

        # 3. Compare with historical fundamentals
        hist_comp: dict[str, Any] = {}
        if historical_fundamentals:
            sorted_f = sorted(historical_fundamentals, key=lambda f: (f.fiscal_year or 0, f.fiscal_period or ""))
            latest_hist = sorted_f[-1]
            hist_comp["latest_recorded_fiscal_year"] = latest_hist.fiscal_year
            hist_comp["latest_recorded_revenue"] = latest_hist.revenue
            hist_comp["latest_recorded_net_income"] = latest_hist.net_income
            hist_comp["latest_recorded_eps"] = latest_hist.eps
            
            if "extracted_revenue" in extracted_kpis and latest_hist.revenue:
                delta = extracted_kpis["extracted_revenue"] - latest_hist.revenue
                hist_comp["revenue_delta_vs_last_recorded"] = delta
                hist_comp["revenue_growth_vs_last_recorded"] = delta / latest_hist.revenue

        summary = (
            f"Berichtsauswertung für {report.title or report.report_type} ({report.fiscal_year or ''} {report.fiscal_period or ''}). "
            f"{len(extracted_kpis)} Kennzahlen extrahiert, {len(risks)} Risikohinweise und {len(opportunities)} Chancen identifiziert."
        )

        return ReportAnalysisResultData(
            summary=summary,
            extracted_kpis=extracted_kpis,
            extracted_statements=extracted_statements,
            identified_trends=identified_trends,
            risks=risks,
            opportunities=opportunities,
            is_verified=False,  # Ungeprüft status
            verification_notes="Automatisch aus Text/Bericht extrahiert. Status: Ungeprüft (erfordert manuelle Verifikation).",
            historical_comparison=hist_comp,
        )
