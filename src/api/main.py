""" Stock Agent API """

from fastapi import FastAPI

app = FastAPI(title="Stock Agent API")


@app.get("/healthcheck")
def health():
    """" Health check endpoint for the API """
    return {"status": "ok", "service": "stock-agent"}
