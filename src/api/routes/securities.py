from fastapi import APIRouter
from fastapi.security import APIKeyHeader

from api.dependencies import DbSession
from api.schemas.security import SecurityCreate, SecurityRead
from api.services.security_service import SecurityService

api_key_header = APIKeyHeader(name="X-API-KEY", auto_error=False, description="API Key for authentication")

router = APIRouter(
    prefix="/securities",
    tags=["Securities"],
    dependencies=[],
)


@router.get(
    "",
    response_model=list[SecurityRead],
    summary="List securities",
    description="Retrieve a list of all stored securities, ordered by their internal ID.",
    responses={
        200: {
            "description": "List of securities",
        },
        401: {
            "description": "Unauthorized - Missing or invalid X-API-KEY header",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid or missing X-API-KEY header."}
                }
            },
        },
    },
)
def list_securities(db: DbSession):
    return SecurityService.get_securities(db)


@router.post(
    "",
    response_model=SecurityRead,
    status_code=201,
    summary="Create or retrieve a security",
    description=(
        "Registers a new security or returns an existing one if the ISIN is already present. "
        "Requires at least an ISIN (WKN-only lookup is not yet supported)."
    ),
    responses={
        201: {
            "description": "Security created or retrieved successfully",
        },
        401: {
            "description": "Unauthorized - Missing or invalid X-API-KEY header",
            "content": {
                "application/json": {
                    "example": {"detail": "Invalid or missing X-API-KEY header."}
                }
            },
        },
        415: {
            "description": "Unsupported Media Type - Content-Type must be application/json",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Unsupported Media Type: 'Content-Type' must be 'application/json' for POST requests."
                    }
                }
            },
        },
        422: {
            "description": "Validation error (e.g. missing ISIN, invalid length)",
        },
        409: {
            "description": "Conflict - A security with this ISIN or WKN already exists",
            "content": {
                "application/json": {
                    "example": {"detail": "A security with this ISIN or WKN already exists."}
                }
            },
        },
    },
)
def create_security(payload: SecurityCreate, db: DbSession):
    return SecurityService.create_security(db, payload)
