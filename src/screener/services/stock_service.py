""" Stock management and financial data synchronization service """

from datetime import date, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from screener.db.models.stock import FundamentalData, Stock, StockPrice
from screener.importers.csv_importer import validate_isin, validate_wkn
from screener.providers.base import BaseDataProvider
from screener.providers.manager import get_data_provider


class StockService:
    @staticmethod
    def get_stocks(
        db: Session,
        query: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Stock]:
        stmt = select(Stock).order_by(Stock.id)
        if query:
            q = f"%{query.strip().upper()}%"
            stmt = stmt.where(
                or_(
                    Stock.isin.ilike(q),
                    Stock.wkn.ilike(q),
                    Stock.ticker.ilike(q),
                    Stock.name.ilike(q),
                )
            )
        stmt = stmt.limit(limit).offset(offset)
        return list(db.scalars(stmt).all())

    @staticmethod
    def get_stock_by_id(db: Session, stock_id: int) -> Stock | None:
        return db.scalar(
            select(Stock)
            .options(
                selectinload(Stock.prices),
                selectinload(Stock.fundamentals),
                selectinload(Stock.reports),
                selectinload(Stock.analysis_results),
            )
            .where(Stock.id == stock_id)
        )

    @staticmethod
    def get_stock_by_identifier(
        db: Session,
        isin: str | None = None,
        wkn: str | None = None,
        ticker: str | None = None,
    ) -> Stock | None:
        if isin:
            isin_clean = isin.strip().upper()
            found = db.scalar(select(Stock).where(Stock.isin == isin_clean))
            if found:
                return found
        if wkn:
            wkn_clean = wkn.strip().upper()
            found = db.scalar(select(Stock).where(Stock.wkn == wkn_clean))
            if found:
                return found
        if ticker:
            ticker_clean = ticker.strip().upper()
            found = db.scalar(select(Stock).where(Stock.ticker == ticker_clean))
            if found:
                return found
        return None

    @classmethod
    def resolve_and_create_stock(
        cls,
        db: Session,
        isin: str | None = None,
        wkn: str | None = None,
        ticker: str | None = None,
        name: str | None = None,
        currency: str | None = None,
        exchange: str | None = None,
        provider: BaseDataProvider | None = None,
    ) -> Stock:
        isin_clean = isin.strip().upper() if isin else None
        wkn_clean = wkn.strip().upper() if wkn else None
        ticker_clean = ticker.strip().upper() if ticker else None

        if not isin_clean and not wkn_clean and not ticker_clean:
            raise HTTPException(
                status_code=422,
                detail="Provide at least an ISIN, WKN, or Ticker.",
            )

        if isin_clean and not validate_isin(isin_clean):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid ISIN format: {isin_clean}",
            )
        if wkn_clean and not validate_wkn(wkn_clean):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid WKN format: {wkn_clean}",
            )

        existing = cls.get_stock_by_identifier(db, isin=isin_clean, wkn=wkn_clean, ticker=ticker_clean)
        if existing:
            # Update fields if more data provided
            updated = False
            if not existing.wkn and wkn_clean:
                existing.wkn = wkn_clean
                updated = True
            if not existing.ticker and ticker_clean:
                existing.ticker = ticker_clean
                updated = True
            if not existing.name and name:
                existing.name = name
                updated = True
            if not existing.currency and currency:
                existing.currency = currency.upper()[:3]
                updated = True
            if updated:
                db.commit()
                db.refresh(existing)
            return existing

        # If name or details missing, try resolving with provider
        active_provider = provider or get_data_provider()
        lookup_target = isin_clean or wkn_clean or ticker_clean
        profile = None
        if lookup_target:
            profile = active_provider.lookup_stock(lookup_target)

        stock = Stock(
            isin=isin_clean or (profile.isin if profile else None),
            wkn=wkn_clean or (profile.wkn if profile else None),
            ticker=ticker_clean or (profile.symbol if profile else None),
            name=name or (profile.name if profile else None),
            exchange=exchange or (profile.exchange if profile else None),
            currency=(currency.upper()[:3] if currency else (profile.currency if profile else "EUR")),
            sector=profile.sector if profile else None,
            industry=profile.industry if profile else None,
            country=profile.country if profile else None,
        )

        db.add(stock)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = cls.get_stock_by_identifier(db, isin=isin_clean, wkn=wkn_clean, ticker=ticker_clean)
            if existing:
                return existing
            raise HTTPException(
                status_code=409,
                detail="A stock with this ISIN, WKN, or Ticker already exists.",
            )

        db.refresh(stock)
        return stock

    @classmethod
    def sync_market_and_fundamental_data(
        cls,
        db: Session,
        stock_id: int,
        provider: BaseDataProvider | None = None,
    ) -> Stock:
        stock = cls.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")

        active_provider = provider or get_data_provider()
        ident = stock.ticker or stock.isin or stock.wkn
        if not ident:
            return stock

        # 1. Sync prices
        prices_data = active_provider.get_historical_prices(ident)
        for p in prices_data:
            existing_p = db.scalar(
                select(StockPrice).where(
                    StockPrice.stock_id == stock.id,
                    StockPrice.date == p.date,
                    StockPrice.data_source == p.data_source,
                )
            )
            if not existing_p:
                db.add(
                    StockPrice(
                        stock_id=stock.id,
                        date=p.date,
                        open=p.open,
                        high=p.high,
                        low=p.low,
                        close=p.close,
                        adjusted_close=p.adjusted_close,
                        volume=p.volume,
                        currency=p.currency,
                        data_source=p.data_source,
                    )
                )

        # 2. Sync fundamentals
        fundamentals_data = active_provider.get_fundamental_data(ident)
        for f in fundamentals_data:
            existing_f = db.scalar(
                select(FundamentalData).where(
                    FundamentalData.stock_id == stock.id,
                    FundamentalData.period_type == f.period_type,
                    FundamentalData.fiscal_year == f.fiscal_year,
                    FundamentalData.fiscal_period == f.fiscal_period,
                    FundamentalData.data_source == f.data_source,
                )
            )
            if not existing_f:
                db.add(
                    FundamentalData(
                        stock_id=stock.id,
                        period_type=f.period_type,
                        fiscal_year=f.fiscal_year,
                        fiscal_period=f.fiscal_period,
                        period_end_date=f.period_end_date,
                        revenue=f.revenue,
                        gross_profit=f.gross_profit,
                        operating_income=f.operating_income,
                        net_income=f.net_income,
                        eps=f.eps,
                        gross_margin=f.gross_margin,
                        operating_margin=f.operating_margin,
                        net_margin=f.net_margin,
                        operating_cash_flow=f.operating_cash_flow,
                        free_cash_flow=f.free_cash_flow,
                        capital_expenditures=f.capital_expenditures,
                        total_assets=f.total_assets,
                        total_equity=f.total_equity,
                        total_debt=f.total_debt,
                        cash_and_equivalents=f.cash_and_equivalents,
                        current_ratio=f.current_ratio,
                        debt_to_equity=f.debt_to_equity,
                        dividend_per_share=f.dividend_per_share,
                        dividend_yield=f.dividend_yield,
                        pe_ratio=f.pe_ratio,
                        ps_ratio=f.ps_ratio,
                        pb_ratio=f.pb_ratio,
                        currency=f.currency,
                        data_source=f.data_source,
                        raw_json=f.raw_data,
                    )
                )

        db.commit()
        db.refresh(stock)
        return stock

    @classmethod
    def update_stock(cls, db: Session, stock_id: int, **kwargs: Any) -> Stock:
        stock = cls.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        
        for key, value in kwargs.items():
            if hasattr(stock, key) and value is not None:
                if key in ["isin", "wkn", "ticker"] and isinstance(value, str):
                    setattr(stock, key, value.strip().upper())
                elif key == "currency" and isinstance(value, str):
                    setattr(stock, key, value.strip().upper()[:3])
                else:
                    setattr(stock, key, value)
        
        try:
            db.commit()
            db.refresh(stock)
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Identifier already in use by another stock.")
        return stock

    @classmethod
    def delete_stock(cls, db: Session, stock_id: int) -> bool:
        stock = cls.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        db.delete(stock)
        db.commit()
        return True

    @staticmethod
    def resolve_preview(db: Session, query: str, provider: BaseDataProvider | None = None) -> dict[str, Any]:
        q = query.strip().upper()
        # First check local DB
        local_match = db.scalar(
            select(Stock).where(
                or_(
                    Stock.isin == q,
                    Stock.wkn == q,
                    Stock.ticker == q,
                )
            )
        )
        if local_match:
            return {
                "resolved": True,
                "isin": local_match.isin,
                "wkn": local_match.wkn,
                "ticker": local_match.ticker,
                "name": local_match.name,
                "exchange": local_match.exchange,
                "currency": local_match.currency,
                "sector": local_match.sector,
                "industry": local_match.industry,
                "country": local_match.country,
                "provider": "local_database",
                "message": "Stock found in local database",
            }
        
        active_provider = provider or get_data_provider()
        profile = active_provider.lookup_stock(q)
        if profile and profile.name:
            return {
                "resolved": True,
                "isin": profile.isin or (q if validate_isin(q) else None),
                "wkn": profile.wkn or (q if validate_wkn(q) else None),
                "ticker": profile.symbol or q,
                "name": profile.name,
                "exchange": profile.exchange,
                "currency": profile.currency or "EUR",
                "sector": profile.sector,
                "industry": profile.industry,
                "country": profile.country,
                "provider": active_provider.provider_name,
                "message": f"Stock resolved via {active_provider.provider_name}",
            }
        
        return {
            "resolved": False,
            "isin": q if validate_isin(q) else None,
            "wkn": q if validate_wkn(q) else None,
            "ticker": q if not validate_isin(q) and not validate_wkn(q) else None,
            "name": None,
            "exchange": None,
            "currency": "EUR",
            "sector": None,
            "industry": None,
            "country": None,
            "provider": active_provider.provider_name,
            "message": "Could not automatically resolve stock details. You can enter them manually.",
        }

    @classmethod
    def sync_all_stocks(cls, db: Session) -> int:
        stocks = list(db.scalars(select(Stock)).all())
        synced = 0
        for s in stocks:
            try:
                cls.sync_market_and_fundamental_data(db, s.id)
                synced += 1
            except Exception:
                pass
        return synced
