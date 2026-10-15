from api.routes.analyses import router as analyses_router
from api.routes.dashboard import router as dashboard_router
from api.routes.health import router as health_router
from api.routes.portfolios import router as portfolios_router
from api.routes.reports import router as reports_router
from api.routes.stocks import router as stocks_router

__all__ = [
    "health_router",
    "dashboard_router",
    "stocks_router",
    "portfolios_router",
    "analyses_router",
    "reports_router",
]
