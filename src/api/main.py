""" Stock screener API """

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

from api.middlewares import AuthenticationMiddleware, ValidationMiddleware
from api.routes import health_router, securities_router
from screener.db.base import Base
from screener.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Temporary bootstrap
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Stock Screener API",
    version="0.1.0",
    description="Stock Screener REST API with authentication and request validation.",
    lifespan=lifespan,
)

# Middlewares (Order of execution: Authentication -> Validation -> Route)
app.add_middleware(ValidationMiddleware)
app.add_middleware(AuthenticationMiddleware)

# Routes
app.include_router(health_router)
app.include_router(securities_router)


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-KEY",
            "description": "API Key required for accessing protected endpoints.",
        }
    }
    openapi_schema["security"] = [{"ApiKeyAuth": []}]
    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi
