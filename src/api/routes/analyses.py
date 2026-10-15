from fastapi import APIRouter, HTTPException, Query

from api.core.dependencies import DbSession
from api.core.responses import (
    RESPONSE_UNAUTHORIZED,
    RESPONSE_UNPROCESSABLE_ENTITY,
)
from api.schemas.analysis import (
    AnalysisJobCreate,
    AnalysisJobRead,
    AnalysisResultRead,
)
from screener.services.analysis_service import AnalysisService

router = APIRouter(
    prefix="/analyses",
    tags=["Analyses"],
)


@router.post(
    "/stocks/{stock_id}",
    response_model=AnalysisJobRead,
    status_code=202,
    summary="Trigger stock fundamental analysis",
    description="Starts a comprehensive fundamental analysis for a single stock. Returns the job status.",
    responses={
        202: {"description": "Analysis job accepted / completed"},
        404: {"description": "Stock not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def analyze_stock(
    stock_id: int,
    db: DbSession,
    sync: bool = Query(default=True, description="Execute synchronously and return completed status"),
):
    return AnalysisService.create_stock_analysis_job(db=db, stock_id=stock_id, execute_sync=sync)


@router.post(
    "/portfolios/{portfolio_id}",
    response_model=AnalysisJobRead,
    status_code=202,
    summary="Trigger portfolio analysis",
    description="Starts an overall portfolio research analysis covering holdings, diversification, fundamentals, and risks.",
    responses={
        202: {"description": "Portfolio analysis job accepted / completed"},
        404: {"description": "Portfolio not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def analyze_portfolio(
    portfolio_id: int,
    db: DbSession,
    sync: bool = Query(default=True, description="Execute synchronously and return completed status"),
):
    return AnalysisService.create_portfolio_analysis_job(db=db, portfolio_id=portfolio_id, execute_sync=sync)


@router.get(
    "/jobs",
    response_model=list[AnalysisJobRead],
    summary="List analysis jobs",
    description="Retrieve all analysis jobs with optional filtering by status or type.",
)
def list_analysis_jobs(
    db: DbSession,
    status: str | None = Query(default=None, description="PENDING, RUNNING, COMPLETED, FAILED"),
    job_type: str | None = Query(default=None, description="STOCK_ANALYSIS, PORTFOLIO_ANALYSIS"),
    stock_id: int | None = Query(default=None),
    portfolio_id: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return AnalysisService.get_jobs(
        db=db,
        status=status,
        job_type=job_type,
        stock_id=stock_id,
        portfolio_id=portfolio_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/jobs/{job_id}/run",
    response_model=AnalysisJobRead,
    summary="Execute specific job",
    description="Manually triggers execution for a pending or failed job.",
)
def run_job(job_id: int, db: DbSession):
    return AnalysisService.execute_job(db, job_id)


@router.post(
    "/run-pending",
    summary="Run all pending analysis jobs",
)
def run_all_pending_jobs(db: DbSession):
    count = AnalysisService.run_pending_jobs(db)
    return {"message": f"Processed {count} pending analysis jobs.", "executed_count": count}


@router.get(
    "/jobs/{job_id}",
    response_model=AnalysisJobRead,
    summary="Get analysis job status",
    responses={
        200: {"description": "Job details and status"},
        404: {"description": "Job not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_job_status(job_id: int, db: DbSession):
    job = AnalysisService.get_job(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get(
    "/results/{result_id}",
    response_model=AnalysisResultRead,
    summary="Get analysis result details",
    description="Retrieve versioned analysis result including scores, evaluation, metrics, risks, and data gaps.",
    responses={
        200: {"description": "Analysis result details"},
        404: {"description": "Result not found"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_analysis_result(result_id: int, db: DbSession):
    result = AnalysisService.get_analysis_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Analysis result not found")
    return result
