from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.schemas.security import SecurityCreate
from screener.db.models import Security


class SecurityService:
    @staticmethod
    def get_securities(db: Session) -> list[Security]:
        return list(db.scalars(select(Security).order_by(Security.id)).all())

    @staticmethod
    def create_security(db: Session, payload: SecurityCreate) -> Security:
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
