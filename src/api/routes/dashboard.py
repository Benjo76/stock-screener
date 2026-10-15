from fastapi import APIRouter

from api.core.dependencies import DbSession
from api.core.responses import RESPONSE_UNAUTHORIZED
from api.schemas.system import DashboardSummaryRead, SystemStatusRead
from screener.services.dashboard_service import DashboardService

router = APIRouter(
    tags=["Dashboard & System"],
)


@router.get(
    "/dashboard/summary",
    response_model=DashboardSummaryRead,
    summary="Get aggregated dashboard summary data",
    description="Calculates portfolio values, asset allocations, warnings, and recent activity across all portfolios.",
    responses={
        200: {"description": "Dashboard overview metrics and lists"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_dashboard_summary(db: DbSession):
    return DashboardService.get_dashboard_summary(db)


@router.get(
    "/system/status",
    response_model=SystemStatusRead,
    summary="Get system and database status",
    description="Provides real-time health, active provider capabilities, and entity statistics.",
    responses={
        200: {"description": "System status"},
        **RESPONSE_UNAUTHORIZED,
    },
)
def get_system_status(db: DbSession):
    return DashboardService.get_system_status(db)
