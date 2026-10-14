from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from screener.db.session import SessionLocal


def get_db():
    with SessionLocal() as session:
        yield session


DbSession = Annotated[Session, Depends(get_db)]
