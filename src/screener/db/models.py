""" Database models for stock screener and portfolio research agent """

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from screener.db.base import Base


class Stock(Base):
    __tablename__ = "stocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin: Mapped[str | None] = mapped_column(
        String(12),
        unique=True,
        index=True,
        nullable=True,
    )
    wkn: Mapped[str | None] = mapped_column(
        String(6),
        unique=True,
        index=True,
        nullable=True,
    )
    ticker: Mapped[str | None] = mapped_column(
        String(32),
        index=True,
        nullable=True,
    )
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    exchange: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    currency: Mapped[str | None] = mapped_column(
        String(3),
        nullable=True,
    )
    sector: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    industry: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    country: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    prices: Mapped[list["StockPrice"]] = relationship(
        "StockPrice", back_populates="stock", cascade="all, delete-orphan"
    )
    fundamentals: Mapped[list["FundamentalData"]] = relationship(
        "FundamentalData", back_populates="stock", cascade="all, delete-orphan"
    )
    reports: Mapped[list["CompanyReport"]] = relationship(
        "CompanyReport", back_populates="stock", cascade="all, delete-orphan"
    )
    holdings: Mapped[list["PortfolioHolding"]] = relationship(
        "PortfolioHolding", back_populates="stock", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["PortfolioTransaction"]] = relationship(
        "PortfolioTransaction", back_populates="stock", cascade="all, delete-orphan"
    )
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(
        "AnalysisResult", back_populates="stock", cascade="all, delete-orphan"
    )


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    holdings: Mapped[list["PortfolioHolding"]] = relationship(
        "PortfolioHolding", back_populates="portfolio", cascade="all, delete-orphan"
    )
    transactions: Mapped[list["PortfolioTransaction"]] = relationship(
        "PortfolioTransaction", back_populates="portfolio", cascade="all, delete-orphan"
    )
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship(
        "AnalysisJob", back_populates="portfolio", cascade="all, delete-orphan"
    )
    analysis_results: Mapped[list["AnalysisResult"]] = relationship(
        "AnalysisResult", back_populates="portfolio", cascade="all, delete-orphan"
    )


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "stock_id", name="uq_portfolio_stock_holding"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    shares: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    average_buy_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    data_source: Mapped[str | None] = mapped_column(String(100), nullable=True, default="csv_import")
    last_imported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="holdings")
    stock: Mapped["Stock"] = relationship("Stock", back_populates="holdings")


class PortfolioTransaction(Base):
    __tablename__ = "portfolio_transactions"
    __table_args__ = (
        Index("ix_portfolio_transactions_date", "transaction_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)  # BUY, SELL, DIVIDEND
    shares: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_per_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False)
    fees: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    external_transaction_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_source: Mapped[str | None] = mapped_column(String(100), nullable=True, default="csv_import")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    portfolio: Mapped["Portfolio"] = relationship("Portfolio", back_populates="transactions")
    stock: Mapped["Stock"] = relationship("Stock", back_populates="transactions")


class StockPrice(Base):
    __tablename__ = "stock_prices"
    __table_args__ = (
        UniqueConstraint("stock_id", "date", "data_source", name="uq_stock_price_date_source"),
        Index("ix_stock_prices_stock_date", "stock_id", "date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float | None] = mapped_column(Float, nullable=True)
    high: Mapped[float | None] = mapped_column(Float, nullable=True)
    low: Mapped[float | None] = mapped_column(Float, nullable=True)
    close: Mapped[float] = mapped_column(Float, nullable=False)
    adjusted_close: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    data_source: Mapped[str] = mapped_column(String(100), nullable=False, default="manual")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    stock: Mapped["Stock"] = relationship("Stock", back_populates="prices")


class FundamentalData(Base):
    __tablename__ = "fundamental_data"
    __table_args__ = (
        UniqueConstraint("stock_id", "period_type", "fiscal_year", "fiscal_period", "data_source", name="uq_stock_fundamental_period"),
        Index("ix_fundamental_data_stock_period", "stock_id", "fiscal_year", "fiscal_period"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_id: Mapped[int] = mapped_column(ForeignKey("stocks.id", ondelete="CASCADE"), nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False, default="annual")  # annual, quarterly, ttm
    fiscal_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fiscal_period: Mapped[str | None] = mapped_column(String(10), nullable=True)  # Q1, Q2, Q3, Q4, FY
    period_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    
    # Income statement
    revenue: Mapped[float | None] = mapped_column(Float, nullable=True)
    gross_profit: Mapped[float | None] = mapped_column(Float, nullable=True)
    operating_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_income: Mapped[float | None] = mapped_column(Float, nullable=True)
    eps: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Margins
    gross_margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    operating_margin: Mapped[float | None] = mapped_column(Float, nullable=True)
    net_margin: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Cashflow
    operating_cash_flow: Mapped[float | None] = mapped_column(Float, nullable=True)
    free_cash_flow: Mapped[float | None] = mapped_column(Float, nullable=True)
    capital_expenditures: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Balance Sheet
    total_assets: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_equity: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_debt: Mapped[float | None] = mapped_column(Float, nullable=True)
    cash_and_equivalents: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    debt_to_equity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Valuation & Dividends
    dividend_per_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    dividend_yield: Mapped[float | None] = mapped_column(Float, nullable=True)
    pe_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    ps_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    pb_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)

    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    data_source: Mapped[str] = mapped_column(String(100), nullable=False, default="manual")
    raw_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    stock: Mapped["Stock"] = relationship("Stock", back_populates="fundamentals")


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
