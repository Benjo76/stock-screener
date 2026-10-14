""" Stock screener API """


from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from screener.db.base import Base
from screener.db.models import Security
from screener.db.session import SessionLocal, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Temporary bootstrap
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Stock Agent API",
    version="0.1.0",
    lifespan=lifespan,
)


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]


class SecurityCreate(BaseModel):
    isin: str | None = Field(default=None, min_length=12, max_length=12)
    wkn: str | None = Field(default=None, min_length=6, max_length=6)
    ticker: str | None = Field(default=None, max_length=32)
    name: str | None = Field(default=None, max_length=255)
    exchange: str | None = Field(default=None, max_length=100)
    currency: str | None = Field(default=None, min_length=3, max_length=3)


class SecurityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    isin: str
    wkn: str | None
    ticker: str | None
    name: str | None
    exchange: str | None
    currency: str | None


@app.get("/healthcheck", tags=["System"])
def healthcheck():
    return {
        "status": "ok",
        "service": "stock-agent"
        }

@app.get("/healthcheck/db", tags=["System"])
def database_healthcheck(db: DbSession):
    from sqlalchemy import text

    db.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "database": "connected"
    }


@app.post(
    "/securities",
    response_model=SecurityRead,
    status_code=201,
    tags=["Securities"],
)
def create_security(payload: SecurityCreate, db: DbSession):
    isin = payload.isin.strip().upper() if payload.isin else None
    wkn = payload.wkn.strip().upper() if payload.wkn else None

    if not isin and not wkn:
        raise HTTPException(
            status_code=422,
            detail="Provide at least an ISIN or a WKN.",
        )

    # At this stage, an ISIN is required by the database model.
    # WKN-only inputs need a security lookup provider first.
    if not isin:
        raise HTTPException(
            status_code=422,
            detail="WKN-only lookup is not implemented yet. Provide an ISIN.",
        )

    existing = db.scalar(
        select(Security).where(Security.isin == isin)
    )
    if existing:
        return existing

    security = Security(
        isin=isin,
        wkn=wkn,
        ticker=payload.ticker,
        name=payload.name,
        exchange=payload.exchange,
        currency=payload.currency.upper() if payload.currency else None,
    )

    db.add(security)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A security with this ISIN or WKN already exists.",
        )

    db.refresh(security)
    return security


@app.get(
    "/securities",
    response_model=list[SecurityRead],
    tags=["Securities"],
)
def list_securities(db: DbSession):
    return list(
        db.scalars(select(Security).order_by(Security.id)).all()
    )
