""" Common OpenAPI response definitions """

RESPONSE_UNAUTHORIZED = {
    401: {
        "description": "Unauthorized - Missing or invalid X-API-KEY header",
        "content": {
            "application/json": {
                "example": {"detail": "Invalid or missing X-API-KEY header."}
            }
        },
    }
}

RESPONSE_UNSUPPORTED_MEDIA_TYPE = {
    415: {
        "description": "Unsupported Media Type - Content-Type must be application/json",
        "content": {
            "application/json": {
                "example": {
                    "detail": "Unsupported Media Type: 'Content-Type' must be 'application/json' for POST requests."
                }
            }
        },
    }
}

RESPONSE_CONFLICT_STOCK = {
    409: {
        "description": "Conflict - A stock with this ISIN or WKN already exists",
        "content": {
            "application/json": {
                "example": {"detail": "A stock with this ISIN or WKN already exists."}
            }
        },
    }
}

RESPONSE_UNPROCESSABLE_ENTITY = {
    422: {
        "description": "Validation error (e.g. missing required fields or invalid length)",
    }
}
