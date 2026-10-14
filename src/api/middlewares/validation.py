from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class ValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate incoming request headers, content types, and general request constraints.
    """

    METHODS_WITH_BODY = {"POST", "PUT", "PATCH"}

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        if request.method in self.METHODS_WITH_BODY:
            content_type = request.headers.get("content-type", "")
            content_length = request.headers.get("content-length")
            
            # If request has a body payload or content length > 0
            if content_length != "0" and (content_length is not None or "transfer-encoding" in request.headers):
                if not content_type.startswith("application/json"):
                    return JSONResponse(
                        status_code=415,
                        content={
                            "detail": (
                                "Unsupported Media Type: 'Content-Type' must be 'application/json' "
                                f"for {request.method} requests."
                            )
                        },
                    )

        return await call_next(request)
