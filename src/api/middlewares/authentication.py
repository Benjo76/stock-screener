import os
from collections.abc import Iterable
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate incoming requests against an X-API-KEY header.
    Certain endpoints (such as docs and healthchecks) can be exempted.
    """

    DEFAULT_EXEMPT_PATHS: set[str] = {
        "/healthcheck",
        "/healthcheck/db",
        "/docs",
        "/redoc",
        "/openapi.json",
    }

    def __init__(
        self,
        app,
        api_key: str | None = None,
        exempt_paths: Iterable[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.api_key = api_key or os.getenv("API_KEY", "dev-secret-key")
        self.exempt_paths = set(exempt_paths) if exempt_paths is not None else self.DEFAULT_EXEMPT_PATHS

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path

        # Allow exempt paths and CORS preflight OPTIONS requests
        if path in self.exempt_paths or request.method == "OPTIONS":
            return await call_next(request)

        provided_key = request.headers.get("X-API-KEY")
        if not provided_key or provided_key != self.api_key:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing X-API-KEY header."},
            )

        return await call_next(request)
