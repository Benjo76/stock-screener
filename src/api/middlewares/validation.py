import os
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint


class ValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate incoming request headers, content types,
    payload size limits, and general request constraints.
    """

    METHODS_WITH_BODY = {"POST", "PUT", "PATCH"}
    ALLOWED_CONTENT_TYPES = (
        "application/json",
        "multipart/form-data",
        "text/csv",
    )
    # Default 10MB limit for uploads
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method in self.METHODS_WITH_BODY:
            content_type = request.headers.get("content-type", "")
            content_length_header = request.headers.get("content-length")

            # Validate payload size limits
            if content_length_header:
                try:
                    content_length = int(content_length_header)
                    if content_length > self.MAX_CONTENT_LENGTH:
                        return JSONResponse(
                            status_code=413,
                            content={
                                "detail": (
                                    f"Payload Too Large: Content length of {content_length} bytes "
                                    f"exceeds maximum allowed limit of {self.MAX_CONTENT_LENGTH} bytes."
                                )
                            },
                        )
                except ValueError:
                    pass

            # If request has a body payload or content length > 0
            if content_length_header != "0" and (
                content_length_header is not None or "transfer-encoding" in request.headers
            ):
                if not any(content_type.startswith(allowed) for allowed in self.ALLOWED_CONTENT_TYPES):
                    return JSONResponse(
                        status_code=415,
                        content={
                            "detail": (
                                "Unsupported Media Type: 'Content-Type' must be 'application/json', "
                                f"'text/csv' or 'multipart/form-data' for {request.method} requests."
                            )
                        },
                    )

        return await call_next(request)
