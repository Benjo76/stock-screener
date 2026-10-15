from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from api.core.dependencies import DbSession
from api.core.responses import (
    RESPONSE_UNAUTHORIZED,
    RESPONSE_UNPROCESSABLE_ENTITY,
)
from api.schemas.report import (
    CompanyReportCreate,
    CompanyReportRead,
    ReportAnalysisRead,
    ReportVerificationUpdate,
)
from screener.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["Reports"],
)


@router.get(
    "",
    response_model=list[CompanyReportRead],
    summary="List all company reports",
    description="Retrieve all reports, optionally filtered by stock, report type, or year.",
)
def list_reports(
    db: DbSession,
    stock_id: int | None = Query(default=None),
    report_type: str | None = Query(default=None),
    fiscal_year: int | None = Query(default=None),
    query: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return ReportService.get_all_reports(
        db=db,
        stock_id=stock_id,
        report_type=report_type,
        fiscal_year=fiscal_year,
        query=query,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/upload",
    response_model=CompanyReportRead,
    status_code=201,
    summary="Upload PDF or text report and analyze",
    description="Uploads a PDF or text document, extracts textual financial data, and runs analysis.",
)
async def upload_report(
    db: DbSession,
    stock_id: int = Form(...),
    report_type: str = Form("ANNUAL_REPORT"),
    fiscal_year: int | None = Form(None),
    fiscal_period: str | None = Form(None),
    title: str | None = Form(None),
    auto_analyze: bool = Form(True),
    file: UploadFile = File(...),
):
    file_bytes = await file.read()
    content_text = ReportService.extract_text_from_file(file_bytes, file.filename or "report.txt")
    
    report_title = title or (file.filename.rsplit(".", 1)[0] if file.filename else f"{report_type} {fiscal_year or ''}".strip())

    return ReportService.create_and_analyze_report(
        db=db,
        stock_id=stock_id,
        report_type=report_type,
        fiscal_year=fiscal_year,
        fiscal_period=fiscal_period,
        title=report_title,
        content_text=content_text,
        data_source="file_upload",
        auto_analyze=auto_analyze,
    )


@router.post(
    "",
    response_model=CompanyReportRead,
    status_code=201,
    summary="Add and optionally analyze a company report",
    description="Stores quarterly or annual company report text and automatically extracts KPIs, statements, risks, and trends.",
    responses={
        201: {"description": "Report stored and processed"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
        **RESPONSE_UNPROCESSABLE_ENTITY,
    },
)
def create_report(payload: CompanyReportCreate, db: DbSession):
    return ReportService.create_and_analyze_report(
        db=db,
        stock_id=payload.stock_id,
        report_type=payload.report_type,
        fiscal_year=payload.fiscal_year,
        fiscal_period=payload.fiscal_period,
        report_date=payload.report_date,
        title=payload.title,
        content_text=payload.content_text,
        source_url=payload.source_url,
        auto_analyze=payload.auto_analyze,
    )


@router.get(
    "/{report_id}",
    response_model=CompanyReportRead,
    summary="Get report and its analyses",
    responses={
        200: {"description": "Report details"},
        404: {"description": "Report not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_report(report_id: int, db: DbSession):
    report = ReportService.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Company report not found")
    return report


@router.delete(
    "/{report_id}",
    status_code=204,
    summary="Delete report",
    description="Deletes a stored report and all its extracted analyses.",
)
def delete_report(report_id: int, db: DbSession):
    ReportService.delete_report(db, report_id)
    return None


@router.post(
    "/{report_id}/analyze",
    response_model=ReportAnalysisRead,
    summary="Run or re-run analysis on an existing report",
    responses={
        200: {"description": "Report analysis result"},
        404: {"description": "Report not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def analyze_existing_report(report_id: int, db: DbSession):
    return ReportService.run_report_analysis(db, report_id)


@router.patch(
    "/analyses/{analysis_id}/verify",
    response_model=ReportAnalysisRead,
    summary="Verify extracted report figures",
    description="Updates verification status of extracted report data from unverified to verified.",
    responses={
        200: {"description": "Verification status updated"},
        404: {"description": "Analysis not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def verify_analysis(
    analysis_id: int,
    payload: ReportVerificationUpdate,
    db: DbSession,
):
    return ReportService.verify_report_analysis(
        db=db,
        analysis_id=analysis_id,
        is_verified=payload.is_verified,
        verification_notes=payload.verification_notes,
    )
