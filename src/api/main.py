"""Stock Screener and Portfolio Research Agent API"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.openapi import setup_openapi
from api.middlewares.authentication import AuthenticationMiddleware
from api.middlewares.validation import ValidationMiddleware
from api.routes.analyses import router as analyses_router
from api.routes.dashboard import router as dashboard_router
from api.routes.health import router as health_router
from api.routes.portfolios import router as portfolios_router
from api.routes.reports import router as reports_router
from api.routes.stocks import router as stocks_router
from screener.db.base import Base
import screener.db.models.job  # noqa # pylint: disable=unused-import
import screener.db.models.portfolio  # noqa # pylint: disable=unused-import
import screener.db.models.report  # noqa # pylint: disable=unused-import
import screener.db.models.stock  # noqa # pylint: disable=unused-import
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
    description=(
        "Stock Screener REST API with authentication, portfolio management, "
        "CSV import, and fundamental analysis."
    ),
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
