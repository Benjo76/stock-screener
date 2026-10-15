"""Company Report and analysis management service"""

import io
from datetime import date

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from screener.analysis.report_analyzer import CompanyReportAnalyzer
from screener.db.models.report import CompanyReport, ReportAnalysis
from screener.db.models.stock import FundamentalData
from screener.services.stock_service import StockService


class ReportService:
    @staticmethod
    def get_all_reports(
        db: Session,
        stock_id: int | None = None,
        report_type: str | None = None,
        fiscal_year: int | None = None,
        query: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CompanyReport]:
        stmt = (
            select(CompanyReport)
            .options(
                selectinload(CompanyReport.analyses),
                selectinload(CompanyReport.stock),
            )
            .order_by(CompanyReport.fiscal_year.desc().nullslast(), CompanyReport.id.desc())
        )
        if stock_id:
            stmt = stmt.where(CompanyReport.stock_id == stock_id)
        if report_type:
            stmt = stmt.where(CompanyReport.report_type == report_type.strip().upper())
        if fiscal_year:
            stmt = stmt.where(CompanyReport.fiscal_year == fiscal_year)
        if query:
            q = f"%{query.strip()}%"
            stmt = stmt.where(
                or_(
                    CompanyReport.title.ilike(q),
                    CompanyReport.report_type.ilike(q),
                )
            )
        stmt = stmt.limit(limit).offset(offset)
        return list(db.scalars(stmt).all())

    @staticmethod
    def delete_report(db: Session, report_id: int) -> bool:
        report = db.scalar(select(CompanyReport).where(CompanyReport.id == report_id))
        if not report:
            raise HTTPException(status_code=404, detail="Company report not found")
        db.delete(report)
        db.commit()
        return True

    @staticmethod
    def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
        filename_lower = filename.lower()
        if filename_lower.endswith(".pdf"):
            try:
                import pypdf

                reader = pypdf.PdfReader(io.BytesIO(file_bytes))
                text_parts = []
                for idx, page in enumerate(reader.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(f"--- Page {idx + 1} ---\n{page_text}")
                extracted = "\n\n".join(text_parts).strip()
                if extracted:
                    return extracted
            except Exception:
                # Fallback to plain string extraction if possible
                pass

        # Default decode utf-8 or latin-1
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1", errors="ignore")

    @staticmethod
    def get_reports_for_stock(db: Session, stock_id: int) -> list[CompanyReport]:
        return list(
            db.scalars(
                select(CompanyReport)
                .options(selectinload(CompanyReport.analyses), selectinload(CompanyReport.stock))
                .where(CompanyReport.stock_id == stock_id)
                .order_by(CompanyReport.fiscal_year.desc().nullslast(), CompanyReport.id.desc())
            ).all()
        )

    @staticmethod
    def get_report_by_id(db: Session, report_id: int) -> CompanyReport | None:
        return db.scalar(
            select(CompanyReport)
            .options(
                selectinload(CompanyReport.analyses),
                selectinload(CompanyReport.stock),
            )
            .where(CompanyReport.id == report_id)
        )

    @classmethod
    def create_and_analyze_report(
        cls,
        db: Session,
        stock_id: int,
        report_type: str,
        fiscal_year: int | None = None,
        fiscal_period: str | None = None,
        report_date: date | None = None,
        title: str | None = None,
        content_text: str | None = None,
        file_path: str | None = None,
        source_url: str | None = None,
        data_source: str = "manual_upload",
        auto_analyze: bool = True,
    ) -> CompanyReport:
        stock = StockService.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")

        report = CompanyReport(
            stock_id=stock_id,
            report_type=report_type.strip().upper(),
            fiscal_year=fiscal_year,
            fiscal_period=fiscal_period.strip().upper() if fiscal_period else None,
            report_date=report_date,
            title=title or f"{report_type} {fiscal_year or ''} {fiscal_period or ''}".strip(),
            content_text=content_text,
            file_path=file_path,
            source_url=source_url,
            data_source=data_source,
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        if auto_analyze and content_text:
            cls.run_report_analysis(db, report.id)

        db.refresh(report)
        return report

    @classmethod
    def run_report_analysis(cls, db: Session, report_id: int) -> ReportAnalysis:
        report = cls.get_report_by_id(db, report_id)
        if not report:
            raise HTTPException(status_code=404, detail="Company report not found")

        stock_fundamentals = list(
            db.scalars(select(FundamentalData).where(FundamentalData.stock_id == report.stock_id)).all()
        )

        analysis_data = CompanyReportAnalyzer.analyze_report(report, stock_fundamentals)

        analysis = ReportAnalysis(
            report_id=report.id,
            stock_id=report.stock_id,
            summary=analysis_data.summary,
            extracted_kpis=analysis_data.extracted_kpis,
            extracted_statements=analysis_data.extracted_statements,
            identified_trends=analysis_data.identified_trends,
            risks=analysis_data.risks,
            opportunities=analysis_data.opportunities,
            is_verified=analysis_data.is_verified,  # False by default
            verification_notes=analysis_data.verification_notes,
            data_source="rule_based_extractor",
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    @classmethod
    def verify_report_analysis(
        cls,
        db: Session,
        analysis_id: int,
        is_verified: bool = True,
        verification_notes: str | None = None,
    ) -> ReportAnalysis:
        analysis = db.scalar(select(ReportAnalysis).where(ReportAnalysis.id == analysis_id))
        if not analysis:
            raise HTTPException(status_code=404, detail="Report analysis not found")

        analysis.is_verified = is_verified
        if verification_notes:
            analysis.verification_notes = verification_notes
        db.commit()
        db.refresh(analysis)
        return analysis
