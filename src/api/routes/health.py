from fastapi import APIRouter
from sqlalchemy import text

from api.dependencies import DbSession

router = APIRouter(tags=["System"])


@router.get(
    "/healthcheck",
    summary="Healthcheck",
    description="Returns the operational status of the service.",
    responses={
        200: {
            "description": "Service is healthy and running",
            "content": {
                "application/json": {
                    "example": {"status": "ok", "service": "stock-agent"}
                }
            },
        }
    },
)
def healthcheck():
    return {
        "status": "ok",
        "service": "stock-agent",
    }


@router.get(
    "/healthcheck/db",
    summary="Database Healthcheck",
    description="Verifies the database connection by executing a test query.",
    responses={
        200: {
            "description": "Database is connected and reachable",
            "content": {
                "application/json": {
                    "example": {"status": "ok", "database": "connected"}
                }
            },
        }
    },
)
def database_healthcheck(db: DbSession):
    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "connected",
    }
