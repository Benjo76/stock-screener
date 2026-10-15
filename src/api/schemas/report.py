from datetime import date, datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class ReportAnalysisRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    report_id: int
    stock_id: int
    summary: str | None = None
    extracted_kpis: dict[str, Any] | None = None
    extracted_statements: list[Any] | None = None
    identified_trends: list[Any] | None = None
    risks: list[Any] | None = None
    opportunities: list[Any] | None = None
    is_verified: bool
    verification_notes: str | None = None
    data_source: str
    created_at: datetime | None = None


class CompanyReportCreate(BaseModel):
    stock_id: int
    report_type: str = Field(
        description="Report type (e.g. ANNUAL_REPORT, QUARTERLY_REPORT, 10-K, 10-Q)", examples=["ANNUAL_REPORT"]
    )
    fiscal_year: int | None = Field(default=None, examples=[2024])
    fiscal_period: str | None = Field(default=None, examples=["FY", "Q3"])
    report_date: date | None = None
    title: str | None = Field(default=None, examples=["Q3 2024 Earnings Release"])
    content_text: str = Field(description="Full or summarized text content of the report for analysis")
    source_url: str | None = None
    auto_analyze: bool = True


class CompanyReportRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stock_id: int
    report_type: str
    fiscal_year: int | None = None
    fiscal_period: str | None = None
    report_date: date | None = None
    title: str | None = None
    content_text: str | None = None
    source_url: str | None = None
    data_source: str
    created_at: datetime | None = None
    analyses: list[ReportAnalysisRead] = []


class ReportVerificationUpdate(BaseModel):
    is_verified: bool = True
    verification_notes: str | None = None
