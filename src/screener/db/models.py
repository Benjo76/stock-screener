""" DB Models """


from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from screener.db.base import Base


class Security(Base):
    __tablename__ = "securities"

    id: Mapped[int] = mapped_column(primary_key=True)
    isin: Mapped[str] = mapped_column(
        String(12),
        unique=True,
        index=True,
    )
    wkn: Mapped[str | None] = mapped_column(
        String(6),
        unique=True,
        index=True,
        nullable=True,
    )
    ticker: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    exchange: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    currency: Mapped[str | None] = mapped_column(
        String(3),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
