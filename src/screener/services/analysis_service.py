"""Analysis Job and Results persistence service"""

from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from screener.analysis.engine import StockAnalysisEngine
from screener.analysis.portfolio_analyzer import PortfolioAnalyzer
from screener.db.models.job import AnalysisJob, AnalysisResult
from screener.db.models.portfolio import Portfolio, PortfolioHolding
from screener.db.models.stock import Stock
from screener.services.stock_service import StockService


class AnalysisService:
    @staticmethod
    def get_job(db: Session, job_id: int) -> AnalysisJob | None:
        return db.scalar(
            select(AnalysisJob)
            .options(
                selectinload(AnalysisJob.results),
                selectinload(AnalysisJob.stock),
                selectinload(AnalysisJob.portfolio),
            )
            .where(AnalysisJob.id == job_id)
        )

    @classmethod
    def create_stock_analysis_job(
        cls,
        db: Session,
        stock_id: int,
        execute_sync: bool = True,
    ) -> AnalysisJob:
        stock = StockService.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")

        # Check for active (PENDING or RUNNING) job for this stock to avoid duplicate parallel runs
        existing_active = db.scalar(
            select(AnalysisJob).where(
                AnalysisJob.stock_id == stock_id,
                AnalysisJob.job_type == "STOCK_ANALYSIS",
                AnalysisJob.status.in_(["PENDING", "RUNNING"]),
            )
        )
        if existing_active:
            if execute_sync and existing_active.status == "PENDING":
                return cls.execute_job(db, existing_active.id)
            return existing_active

        job = AnalysisJob(
            job_type="STOCK_ANALYSIS",
            stock_id=stock_id,
            status="PENDING",
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        if execute_sync:
            return cls.execute_job(db, job.id)
        return job

    @classmethod
    def create_portfolio_analysis_job(
        cls,
        db: Session,
        portfolio_id: int,
        execute_sync: bool = True,
    ) -> AnalysisJob:
        portfolio = db.scalar(select(Portfolio).where(Portfolio.id == portfolio_id))
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        existing_active = db.scalar(
            select(AnalysisJob).where(
                AnalysisJob.portfolio_id == portfolio_id,
                AnalysisJob.job_type == "PORTFOLIO_ANALYSIS",
                AnalysisJob.status.in_(["PENDING", "RUNNING"]),
            )
        )
        if existing_active:
            if execute_sync and existing_active.status == "PENDING":
                return cls.execute_job(db, existing_active.id)
            return existing_active

        job = AnalysisJob(
            job_type="PORTFOLIO_ANALYSIS",
            portfolio_id=portfolio_id,
            status="PENDING",
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        if execute_sync:
            return cls.execute_job(db, job.id)
        return job

    @classmethod
    def execute_job(cls, db: Session, job_id: int) -> AnalysisJob:
        job = cls.get_job(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Analysis job not found")

        job.status = "RUNNING"
        job.started_at = datetime.now()
        db.commit()

        try:
            if job.job_type == "STOCK_ANALYSIS":
                cls._run_stock_analysis(db, job)
            elif job.job_type == "PORTFOLIO_ANALYSIS":
                cls._run_portfolio_analysis(db, job)
            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            job.status = "COMPLETED"
            job.completed_at = datetime.now()
            db.commit()

        except Exception as e:
            db.rollback()
            job.status = "FAILED"
            job.error_message = str(e)
            job.completed_at = datetime.now()
            db.commit()

        db.refresh(job)
        return job

    @classmethod
    def _run_stock_analysis(cls, db: Session, job: AnalysisJob) -> None:
        stock = StockService.get_stock_by_id(db, job.stock_id)
        if not stock:
            raise ValueError(f"Stock with id {job.stock_id} not found")

        # Sync data if fundamentals are missing
        if not stock.fundamentals:
            try:
                StockService.sync_market_and_fundamental_data(db, stock.id)
                db.refresh(stock)
            except Exception:
                pass

        evaluation = StockAnalysisEngine.analyze(stock, stock.fundamentals, stock.prices)

        # Get latest version number for this stock
        max_version = (
            db.scalar(
                select(func.coalesce(func.max(AnalysisResult.version), 0)).where(AnalysisResult.stock_id == stock.id)
            )
            or 0
        )
        new_version = max_version + 1

        details = {
            "growth_score": evaluation.growth_score,
            "profitability_score": evaluation.profitability_score,
            "stability_score": evaluation.stability_score,
            "valuation_score": evaluation.valuation_score,
            "metrics": evaluation.metrics,
            "trends": evaluation.trends,
            "risks": evaluation.risks,
            "opportunities": evaluation.opportunities,
        }

        result = AnalysisResult(
            job_id=job.id,
            stock_id=stock.id,
            version=new_version,
            analysis_type="FUNDAMENTAL",
            headline=evaluation.headline,
            score=evaluation.score,
            summary=evaluation.summary,
            details=details,
            data_gaps=evaluation.data_gaps,
            uncertainties=evaluation.uncertainties,
            data_sources=evaluation.data_sources,
            data_timestamp=evaluation.data_timestamp,
        )
        db.add(result)
        db.commit()

    @classmethod
    def _run_portfolio_analysis(cls, db: Session, job: AnalysisJob) -> None:
        portfolio = db.scalar(
            select(Portfolio)
            .options(
                selectinload(Portfolio.holdings).selectinload(PortfolioHolding.stock).selectinload(Stock.fundamentals),
                selectinload(Portfolio.holdings).selectinload(PortfolioHolding.stock).selectinload(Stock.prices),
            )
            .where(Portfolio.id == job.portfolio_id)
        )
        if not portfolio:
            raise ValueError(f"Portfolio with id {job.portfolio_id} not found")

        # For holdings lacking fundamentals, try syncing
        for h in portfolio.holdings:
            if h.stock and not h.stock.fundamentals:
                try:
                    StockService.sync_market_and_fundamental_data(db, h.stock.id)
                except Exception:
                    pass

        db.refresh(portfolio)

        evaluation = PortfolioAnalyzer.analyze_portfolio(portfolio)

        max_version = (
            db.scalar(
                select(func.coalesce(func.max(AnalysisResult.version), 0)).where(
                    AnalysisResult.portfolio_id == portfolio.id
                )
            )
            or 0
        )
        new_version = max_version + 1

        details = {
            "total_invested_cost": evaluation.total_invested_cost,
            "total_current_value": evaluation.total_current_value,
            "total_unrealized_gain_loss": evaluation.total_unrealized_gain_loss,
            "total_unrealized_return_pct": evaluation.total_unrealized_return_pct,
            "currency": evaluation.currency,
            "positions_count": evaluation.positions_count,
            "holdings_breakdown": evaluation.holdings_breakdown,
            "sector_allocation": evaluation.sector_allocation,
            "currency_allocation": evaluation.currency_allocation,
            "trends": evaluation.trends,
            "risks": evaluation.risks,
            "opportunities": evaluation.opportunities,
        }

        result = AnalysisResult(
            job_id=job.id,
            portfolio_id=portfolio.id,
            version=new_version,
            analysis_type="PORTFOLIO_OVERVIEW",
            headline=evaluation.headline,
            score=evaluation.score,
            summary=evaluation.summary,
            details=details,
            data_gaps=evaluation.data_gaps,
            uncertainties=evaluation.uncertainties,
            data_sources=evaluation.data_sources,
            data_timestamp=evaluation.data_timestamp,
        )
        db.add(result)
        db.commit()

    @staticmethod
    def get_stock_analyses(db: Session, stock_id: int) -> list[AnalysisResult]:
        return list(
            db.scalars(
                select(AnalysisResult)
                .where(AnalysisResult.stock_id == stock_id)
                .order_by(AnalysisResult.version.desc())
            ).all()
        )

    @staticmethod
    def get_portfolio_analyses(db: Session, portfolio_id: int) -> list[AnalysisResult]:
        return list(
            db.scalars(
                select(AnalysisResult)
                .where(AnalysisResult.portfolio_id == portfolio_id)
                .order_by(AnalysisResult.version.desc())
            ).all()
        )

    @staticmethod
    def get_analysis_result(db: Session, result_id: int) -> AnalysisResult | None:
        return db.scalar(
            select(AnalysisResult)
            .options(
                selectinload(AnalysisResult.stock),
                selectinload(AnalysisResult.portfolio),
                selectinload(AnalysisResult.job),
            )
            .where(AnalysisResult.id == result_id)
        )

    @staticmethod
    def get_jobs(
        db: Session,
        status: str | None = None,
        job_type: str | None = None,
        stock_id: int | None = None,
        portfolio_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AnalysisJob]:
        stmt = (
            select(AnalysisJob)
            .options(
                selectinload(AnalysisJob.stock),
                selectinload(AnalysisJob.portfolio),
            )
            .order_by(AnalysisJob.id.desc())
        )
        if status:
            stmt = stmt.where(AnalysisJob.status == status.upper())
        if job_type:
            stmt = stmt.where(AnalysisJob.job_type == job_type.upper())
        if stock_id:
            stmt = stmt.where(AnalysisJob.stock_id == stock_id)
        if portfolio_id:
            stmt = stmt.where(AnalysisJob.portfolio_id == portfolio_id)
        stmt = stmt.limit(limit).offset(offset)
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_recent_results(db: Session, limit: int = 10) -> list[AnalysisResult]:
        return list(
            db.scalars(
                select(AnalysisResult)
                .options(
                    selectinload(AnalysisResult.stock),
                    selectinload(AnalysisResult.portfolio),
                )
                .order_by(AnalysisResult.id.desc())
                .limit(limit)
            ).all()
        )

    @classmethod
    def run_pending_jobs(cls, db: Session) -> int:
        pending_jobs = list(
            db.scalars(select(AnalysisJob).where(AnalysisJob.status == "PENDING").order_by(AnalysisJob.id)).all()
        )
        count = 0
        for job in pending_jobs:
            try:
                cls.execute_job(db, job.id)
                count += 1
            except Exception:
                pass
        return count
