from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from screener.db.base import Base

if TYPE_CHECKING:
    from screener.db.models.portfolio import Portfolio
    from screener.db.models.stock import Stock


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_type: Mapped[str] = mapped_column(String(50), nullable=False)  # STOCK_ANALYSIS, PORTFOLIO_ANALYSIS, REPORT_ANALYSIS, DATA_SYNC
    stock_id: Mapped[int | None] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=True)
    portfolio_id: Mapped[int | None] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)  # PENDING, RUNNING, COMPLETED, FAILED
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    params: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    portfolio: Mapped["Portfolio | None"] = relationship("Portfolio", back_populates="analysis_jobs")
    stock: Mapped["Stock | None"] = relationship("Stock")
    results: Mapped[list["AnalysisResult"]] = relationship(
        "AnalysisResult", back_populates="job", cascade="all, delete-orphan"
    )


class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    __table_args__ = (
        Index("ix_analysis_results_stock_version", "stock_id", "version"),
        Index("ix_analysis_results_portfolio_version", "portfolio_id", "version"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="SET NULL"), nullable=True)
    stock_id: Mapped[int | None] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=True)
    portfolio_id: Mapped[int | None] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(50), nullable=False)  # FUNDAMENTAL, PORTFOLIO_OVERVIEW, COMPREHENSIVE
    headline: Mapped[str | None] = mapped_column(String(255), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    data_gaps: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    uncertainties: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    data_sources: Mapped[list[Any] | None] = mapped_column(JSON, nullable=True)
    data_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    job: Mapped["AnalysisJob | None"] = relationship("AnalysisJob", back_populates="results")
    stock: Mapped["Stock | None"] = relationship("Stock", back_populates="analysis_results")
    portfolio: Mapped["Portfolio | None"] = relationship("Portfolio", back_populates="analysis_results")
