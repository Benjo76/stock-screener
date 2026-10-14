from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.schemas.stock import StockCreate
from screener.db.models import Stock


class StockService:
    @staticmethod
    def get_stocks(db: Session) -> list[Stock]:
        return list(db.scalars(select(Stock).order_by(Stock.id)).all())

    @staticmethod
    def create_stock(db: Session, payload: StockCreate) -> Stock:
        isin = payload.isin.strip().upper() if payload.isin else None
        wkn = payload.wkn.strip().upper() if payload.wkn else None

        if not isin and not wkn:
            raise HTTPException(
                status_code=422,
                detail="Provide at least an ISIN or a WKN.",
            )

        # At this stage, an ISIN is required by the database model.
        # WKN-only inputs need a stock lookup provider first.
        if not isin:
            raise HTTPException(
                status_code=422,
                detail="WKN-only lookup is not implemented yet. Provide an ISIN.",
            )

        existing = db.scalar(
            select(Stock).where(Stock.isin == isin)
        )
        if existing:
            return existing

        stock = Stock(
            isin=isin,
            wkn=wkn,
            ticker=payload.ticker,
            name=payload.name,
            exchange=payload.exchange,
            currency=payload.currency.upper() if payload.currency else None,
        )

        db.add(stock)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="A stock with this ISIN or WKN already exists.",
            )

        db.refresh(stock)
        return stock
