"""Stock Agent API """

from fastapi import FastAPI

app = FastAPI(
    title="Stock Agent API",
    version="0.1.0",
)


@app.get("/healthcheck", tags=["System"])
def healthcheck() -> dict[str, str]:
    """ Check API health status """
    return {
        "status": "ok",
        "service": "stock-screener",
    }
