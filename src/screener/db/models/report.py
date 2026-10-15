from datetime import date, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from screener.db.base import Base

if TYPE_CHECKING:
    from screener.db.models.stock import Stock


class CompanyReport(Base):
    __tablename__ = "company_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    report_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ANNUAL, QUARTERLY, 10-K, 10-Q, PRESS_RELEASE
    fiscal_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fiscal_period: Mapped[str | None] = mapped_column(String(20), nullable=True)
    report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    data_source: Mapped[str] = mapped_column(String(100), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    stock: Mapped["Stock"] = relationship("Stock", back_populates="reports")
    analyses: Mapped[list["ReportAnalysis"]] = relationship(
        "ReportAnalysis", back_populates="report", cascade="all, delete-orphan"
    )


class ReportAnalysis(Base):
    __tablename__ = "report_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("company_reports.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_kpis: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    extracted_statements: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    identified_trends: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    risks: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    opportunities: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_source: Mapped[str] = mapped_column(String(100), nullable=False, default="rule_based_extractor")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    report: Mapped["CompanyReport"] = relationship("CompanyReport", back_populates="analyses")
    stock: Mapped["Stock"] = relationship("Stock")
