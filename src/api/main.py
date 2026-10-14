""" Stock screener API """

from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.middlewares import AuthenticationMiddleware, ValidationMiddleware
from api.openapi import setup_openapi
from api.routes import health_router, stocks_router
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

# OpenAPI & Swagger setup
setup_openapi(app)

# Middlewares (Order of execution: Authentication -> Validation -> Route)
app.add_middleware(ValidationMiddleware)
app.add_middleware(AuthenticationMiddleware)

# Routes
app.include_router(health_router)
app.include_router(stocks_router)
