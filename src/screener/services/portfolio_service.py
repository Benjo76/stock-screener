""" Portfolio management and CSV import service """

from datetime import datetime
from typing import Any, Literal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from screener.db.models import (
    Portfolio,
    PortfolioHolding,
    PortfolioTransaction,
    Stock,
)
from screener.importers.csv_importer import (
    CsvPortfolioImporter,
    CsvValidationResult,
)
from screener.services.stock_service import StockService


class PortfolioService:
    @staticmethod
    def get_portfolios(db: Session) -> list[Portfolio]:
        return list(
            db.scalars(
                select(Portfolio)
                .options(
                    selectinload(Portfolio.holdings).selectinload(PortfolioHolding.stock),
                    selectinload(Portfolio.transactions),
                )
                .order_by(Portfolio.id)
            ).all()
        )

    @staticmethod
    def get_portfolio_by_id(db: Session, portfolio_id: int) -> Portfolio | None:
        return db.scalar(
            select(Portfolio)
            .options(
                selectinload(Portfolio.holdings).selectinload(PortfolioHolding.stock),
                selectinload(Portfolio.transactions).selectinload(PortfolioTransaction.stock),
                selectinload(Portfolio.analysis_results),
            )
            .where(Portfolio.id == portfolio_id)
        )

    @staticmethod
    def create_portfolio(
        db: Session,
        name: str,
        description: str | None = None,
        currency: str = "EUR",
    ) -> Portfolio:
        if not name or not name.strip():
            raise HTTPException(status_code=422, detail="Portfolio name cannot be empty")
        
        portfolio = Portfolio(
            name=name.strip(),
            description=description.strip() if description else None,
            currency=currency.strip().upper()[:3] if currency else "EUR",
        )
        db.add(portfolio)
        db.commit()
        db.refresh(portfolio)
        return portfolio

    @staticmethod
    def delete_portfolio(db: Session, portfolio_id: int) -> bool:
        portfolio = db.scalar(select(Portfolio).where(Portfolio.id == portfolio_id))
        if not portfolio:
            return False
        db.delete(portfolio)
        db.commit()
        return True

    @staticmethod
    def preview_csv_import(
        csv_content: str,
        forced_type: Literal["holdings", "transactions"] | None = None,
    ) -> CsvValidationResult:
        return CsvPortfolioImporter.parse_csv_content(csv_content, forced_type=forced_type)

    @classmethod
    def execute_csv_import(
        cls,
        db: Session,
        portfolio_id: int,
        csv_content: str,
        forced_type: Literal["holdings", "transactions"] | None = None,
    ) -> dict[str, Any]:
        portfolio = cls.get_portfolio_by_id(db, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        validation = CsvPortfolioImporter.parse_csv_content(csv_content, forced_type=forced_type)
        if validation.errors and not (validation.holdings or validation.transactions):
            raise HTTPException(
                status_code=400,
                detail=f"CSV import failed validation: {'; '.join(validation.errors)}",
            )

        now = datetime.now()
        imported_count = 0
        skipped_count = 0
        row_errors: list[dict[str, Any]] = []

        if validation.import_type == "holdings":
            for row in validation.holdings:
                if not row.is_valid:
                    row_errors.append({"row": row.row_number, "errors": row.errors, "data": row.raw_data})
                    skipped_count += 1
                    continue

                # Find or create stock
                stock = StockService.resolve_and_create_stock(
                    db=db,
                    isin=row.isin,
                    wkn=row.wkn,
                    ticker=row.ticker,
                    name=row.name,
                    currency=row.currency,
                )

                # Upsert holding
                holding = db.scalar(
                    select(PortfolioHolding).where(
                        PortfolioHolding.portfolio_id == portfolio.id,
                        PortfolioHolding.stock_id == stock.id,
                    )
                )
                if holding:
                    holding.shares = row.shares
                    holding.average_buy_price = row.average_buy_price
                    holding.total_cost = row.total_cost
                    holding.currency = row.currency
                    holding.last_imported_at = now
                else:
                    holding = PortfolioHolding(
                        portfolio_id=portfolio.id,
                        stock_id=stock.id,
                        shares=row.shares,
                        average_buy_price=row.average_buy_price,
                        total_cost=row.total_cost,
                        currency=row.currency,
                        last_imported_at=now,
                    )
                    db.add(holding)
                    db.flush()

                if row.current_price is not None:
                    from screener.db.models import StockPrice
                    today = now.date()
                    existing_sp = db.scalar(
                        select(StockPrice).where(
                            StockPrice.stock_id == stock.id,
                            StockPrice.date == today,
                            StockPrice.data_source == "csv_import",
                        )
                    )
                    if existing_sp:
                        existing_sp.close = row.current_price
                    else:
                        db.add(
                            StockPrice(
                                stock_id=stock.id,
                                date=today,
                                close=row.current_price,
                                currency=row.currency or "EUR",
                                data_source="csv_import",
                            )
                        )

                imported_count += 1

            db.commit()

        elif validation.import_type == "transactions":
            for row in validation.transactions:
                if not row.is_valid:
                    row_errors.append({"row": row.row_number, "errors": row.errors, "data": row.raw_data})
                    skipped_count += 1
                    continue

                # Duplicate detection by external_transaction_id or matching tuple
                if row.external_transaction_id:
                    existing_tx = db.scalar(
                        select(PortfolioTransaction).where(
                            PortfolioTransaction.portfolio_id == portfolio.id,
                            PortfolioTransaction.external_transaction_id == row.external_transaction_id,
                        )
                    )
                    if existing_tx:
                        skipped_count += 1
                        row_errors.append({
                            "row": row.row_number,
                            "errors": [f"Duplicate external transaction ID: '{row.external_transaction_id}'"],
                            "data": row.raw_data,
                        })
                        continue

                stock = StockService.resolve_and_create_stock(
                    db=db,
                    isin=row.isin,
                    wkn=row.wkn,
                    ticker=row.ticker,
                    name=row.name,
                    currency=row.currency,
                )

                tx = PortfolioTransaction(
                    portfolio_id=portfolio.id,
                    stock_id=stock.id,
                    transaction_type=row.transaction_type,
                    transaction_date=row.transaction_date or now,
                    shares=row.shares,
                    price_per_share=row.price_per_share,
                    total_amount=row.total_amount,
                    fees=row.fees,
                    currency=row.currency,
                    external_transaction_id=row.external_transaction_id,
                    notes=row.notes,
                )
                db.add(tx)

                # Update holding state based on transaction
                holding = db.scalar(
                    select(PortfolioHolding).where(
                        PortfolioHolding.portfolio_id == portfolio.id,
                        PortfolioHolding.stock_id == stock.id,
                    )
                )
                if not holding:
                    holding = PortfolioHolding(
                        portfolio_id=portfolio.id,
                        stock_id=stock.id,
                        shares=0.0,
                        average_buy_price=0.0,
                        total_cost=0.0,
                        currency=row.currency,
                        last_imported_at=now,
                    )
                    db.add(holding)
                    db.flush()

                if row.transaction_type == "BUY":
                    new_shares = holding.shares + (row.shares or 0.0)
                    new_cost = (holding.total_cost or 0.0) + row.total_amount
                    holding.shares = new_shares
                    holding.total_cost = new_cost
                    holding.average_buy_price = round(new_cost / new_shares, 4) if new_shares > 0 else 0.0
                    holding.last_imported_at = now
                elif row.transaction_type == "SELL":
                    sell_shares = row.shares or 0.0
                    if holding.shares > 0:
                        cost_reduction = (holding.total_cost or 0.0) * (sell_shares / holding.shares)
                        holding.shares = max(0.0, holding.shares - sell_shares)
                        holding.total_cost = max(0.0, (holding.total_cost or 0.0) - cost_reduction)
                        if holding.shares > 0 and holding.total_cost:
                            holding.average_buy_price = round(holding.total_cost / holding.shares, 4)
                        else:
                            holding.average_buy_price = 0.0
                    holding.last_imported_at = now

                imported_count += 1

            db.commit()

        return {
            "portfolio_id": portfolio_id,
            "import_type": validation.import_type,
            "total_rows": validation.total_rows,
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "row_errors": row_errors,
        }

    @classmethod
    def update_portfolio(cls, db: Session, portfolio_id: int, **kwargs: Any) -> Portfolio:
        portfolio = cls.get_portfolio_by_id(db, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        for key, value in kwargs.items():
            if hasattr(portfolio, key) and value is not None:
                if key == "currency" and isinstance(value, str):
                    setattr(portfolio, key, value.strip().upper()[:3])
                elif key == "name" and isinstance(value, str):
                    setattr(portfolio, key, value.strip())
                else:
                    setattr(portfolio, key, value)
        portfolio.updated_at = datetime.now()
        db.commit()
        db.refresh(portfolio)
        return portfolio

    @classmethod
    def add_or_update_holding(
        cls,
        db: Session,
        portfolio_id: int,
        stock_id: int | None = None,
        isin: str | None = None,
        wkn: str | None = None,
        ticker: str | None = None,
        name: str | None = None,
        shares: float = 0.0,
        average_buy_price: float | None = None,
        current_price: float | None = None,
        currency: str = "EUR",
    ) -> PortfolioHolding:
        portfolio = cls.get_portfolio_by_id(db, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        if stock_id:
            stock = StockService.get_stock_by_id(db, stock_id)
            if not stock:
                raise HTTPException(status_code=404, detail="Stock not found")
        else:
            stock = StockService.resolve_and_create_stock(
                db=db,
                isin=isin,
                wkn=wkn,
                ticker=ticker,
                name=name,
                currency=currency,
            )

        now = datetime.now()
        total_cost = (shares * average_buy_price) if average_buy_price is not None else None

        holding = db.scalar(
            select(PortfolioHolding).where(
                PortfolioHolding.portfolio_id == portfolio_id,
                PortfolioHolding.stock_id == stock.id,
            )
        )
        if holding:
            holding.shares = shares
            holding.average_buy_price = average_buy_price
            holding.total_cost = total_cost
            holding.currency = currency
            holding.last_imported_at = now
        else:
            holding = PortfolioHolding(
                portfolio_id=portfolio.id,
                stock_id=stock.id,
                shares=shares,
                average_buy_price=average_buy_price,
                total_cost=total_cost,
                currency=currency,
                last_imported_at=now,
            )
            db.add(holding)

        if current_price is not None:
            from screener.db.models import StockPrice
            today = now.date()
            existing_sp = db.scalar(
                select(StockPrice).where(
                    StockPrice.stock_id == stock.id,
                    StockPrice.date == today,
                    StockPrice.data_source == "manual",
                )
            )
            if existing_sp:
                existing_sp.close = current_price
            else:
                db.add(
                    StockPrice(
                        stock_id=stock.id,
                        date=today,
                        close=current_price,
                        currency=currency,
                        data_source="manual",
                    )
                )

        portfolio.updated_at = now
        db.commit()
        db.refresh(holding)
        return holding

    @classmethod
    def delete_holding(cls, db: Session, portfolio_id: int, holding_id: int) -> bool:
        holding = db.scalar(
            select(PortfolioHolding).where(
                PortfolioHolding.portfolio_id == portfolio_id,
                PortfolioHolding.id == holding_id,
            )
        )
        if not holding:
            raise HTTPException(status_code=404, detail="Holding not found in portfolio")
        db.delete(holding)
        db.commit()
        return True

    @classmethod
    def add_transaction(
        cls,
        db: Session,
        portfolio_id: int,
        stock_id: int,
        transaction_type: str = "BUY",
        shares: float | None = None,
        price_per_share: float | None = None,
        total_amount: float = 0.0,
        fees: float = 0.0,
        currency: str = "EUR",
        transaction_date: datetime | None = None,
        notes: str | None = None,
    ) -> PortfolioTransaction:
        portfolio = cls.get_portfolio_by_id(db, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        stock = StockService.get_stock_by_id(db, stock_id)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")

        tx_type = transaction_type.strip().upper()
        now = datetime.now()
        tx = PortfolioTransaction(
            portfolio_id=portfolio_id,
            stock_id=stock_id,
            transaction_type=tx_type,
            shares=shares,
            price_per_share=price_per_share,
            total_amount=total_amount,
            fees=fees,
            currency=currency,
            transaction_date=transaction_date or now,
            notes=notes,
        )
        db.add(tx)

        # Update holding
        holding = db.scalar(
            select(PortfolioHolding).where(
                PortfolioHolding.portfolio_id == portfolio_id,
                PortfolioHolding.stock_id == stock_id,
            )
        )
        if not holding:
            holding = PortfolioHolding(
                portfolio_id=portfolio_id,
                stock_id=stock_id,
                shares=0.0,
                average_buy_price=0.0,
                total_cost=0.0,
                currency=currency,
                last_imported_at=now,
            )
            db.add(holding)
            db.flush()

        if tx_type == "BUY" and shares:
            new_shares = holding.shares + shares
            new_cost = (holding.total_cost or 0.0) + total_amount
            holding.shares = new_shares
            holding.total_cost = new_cost
            holding.average_buy_price = round(new_cost / new_shares, 4) if new_shares > 0 else 0.0
            holding.last_imported_at = now
        elif tx_type == "SELL" and shares:
            if holding.shares > 0:
                cost_reduction = (holding.total_cost or 0.0) * (shares / holding.shares)
                holding.shares = max(0.0, holding.shares - shares)
                holding.total_cost = max(0.0, (holding.total_cost or 0.0) - cost_reduction)
                if holding.shares > 0 and holding.total_cost:
                    holding.average_buy_price = round(holding.total_cost / holding.shares, 4)
                else:
                    holding.average_buy_price = 0.0
            holding.last_imported_at = now

        db.commit()
        db.refresh(tx)
        return tx

    @classmethod
    def get_portfolio_summary(cls, db: Session, portfolio_id: int) -> dict[str, Any]:
        portfolio = cls.get_portfolio_by_id(db, portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")

        from screener.db.models import StockPrice

        total_cost = 0.0
        total_value = 0.0
        has_prices = False
        top_holdings = []
        sector_allocation: dict[str, float] = {}
        currency_allocation: dict[str, float] = {}

        for h in portfolio.holdings:
            stk = h.stock
            cost = h.total_cost if h.total_cost is not None else ((h.shares * h.average_buy_price) if h.average_buy_price else 0.0)
            total_cost += cost

            # get latest price
            latest_price = None
            if stk:
                latest_price = db.scalar(
                    select(StockPrice)
                    .where(StockPrice.stock_id == stk.id)
                    .order_by(StockPrice.date.desc())
                    .limit(1)
                )

            m_val = None
            gain_loss = None
            return_pct = None
            if latest_price and latest_price.close:
                has_prices = True
                m_val = round(h.shares * latest_price.close, 2)
                total_value += m_val
                if cost > 0:
                    gain_loss = round(m_val - cost, 2)
                    return_pct = round((gain_loss / cost) * 100, 2)
            
            sector = stk.sector if (stk and stk.sector) else "Unclassified"
            curr = h.currency or portfolio.currency or "EUR"
            
            # Allocation by value or cost
            alloc_base = m_val if m_val is not None else cost
            sector_allocation[sector] = sector_allocation.get(sector, 0.0) + alloc_base
            currency_allocation[curr] = currency_allocation.get(curr, 0.0) + alloc_base

            top_holdings.append({
                "holding_id": h.id,
                "stock_id": stk.id if stk else None,
                "name": stk.name if stk else "Unknown",
                "ticker": stk.ticker if stk else None,
                "isin": stk.isin if stk else None,
                "shares": h.shares,
                "average_buy_price": h.average_buy_price,
                "purchase_price": h.average_buy_price,
                "current_price": latest_price.close if latest_price else None,
                "total_cost": round(cost, 2),
                "market_value": m_val,
                "gain_loss": gain_loss,
                "return_pct": return_pct,
                "currency": curr,
                "sector": sector,
            })

        # Calculate weights and normalize allocation percentages
        effective_total = total_value if has_prices and total_value > 0 else (total_cost if total_cost > 0 else 1.0)
        for th in top_holdings:
            val = th["market_value"] if th["market_value"] is not None else th["total_cost"]
            th["weight_pct"] = round((val / effective_total) * 100, 2) if effective_total > 0 else 0.0

        top_holdings.sort(key=lambda x: (x["market_value"] if x["market_value"] is not None else x["total_cost"]), reverse=True)

        sector_pcts = {k: round((v / effective_total) * 100, 2) for k, v in sector_allocation.items()}
        curr_pcts = {k: round((v / effective_total) * 100, 2) for k, v in currency_allocation.items()}

        final_total_val = round(total_value, 2) if has_prices else None
        final_gain_loss = round(total_value - total_cost, 2) if (has_prices and total_cost is not None) else None
        final_return_pct = round(((total_value - total_cost) / total_cost) * 100, 2) if (has_prices and total_cost and total_cost > 0) else None

        return {
            "portfolio_id": portfolio.id,
            "name": portfolio.name,
            "currency": portfolio.currency,
            "total_cost": round(total_cost, 2),
            "total_value": final_total_val,
            "total_gain_loss": final_gain_loss,
            "total_return_pct": final_return_pct,
            "positions_count": len(portfolio.holdings),
            "top_holdings": top_holdings,
            "sector_allocation": sector_pcts,
            "currency_allocation": curr_pcts,
        }
