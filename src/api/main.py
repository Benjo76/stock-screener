""" Stock Screener and Portfolio Research Agent API """

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.middlewares import AuthenticationMiddleware, ValidationMiddleware
from api.openapi import setup_openapi
from api.routes import (
    analyses_router,
    dashboard_router,
    health_router,
    portfolios_router,
    reports_router,
    stocks_router,
)
from screener.db.base import Base
from screener.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # In test environment, ensure tables are available if needed
    if os.getenv("APP_ENV") == "test":
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Stock Screener API",
    version="0.1.0",
    description="Stock Screener REST API with authentication, portfolio management, CSV import, and fundamental analysis.",
    lifespan=lifespan,
)

# OpenAPI & Swagger setup
setup_openapi(app)

# Middlewares (Order of execution: CORS -> Authentication -> Validation -> Route)
app.add_middleware(ValidationMiddleware)
app.add_middleware(AuthenticationMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(stocks_router)
app.include_router(portfolios_router)
app.include_router(analyses_router)
app.include_router(reports_router)
