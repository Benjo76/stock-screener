from fastapi import FastAPI

app = FastAPI(title="Stock Agent API")


@app.get("/healthcheck")
def health():
    return {"status": "ok", "service": "stock-agent"}
