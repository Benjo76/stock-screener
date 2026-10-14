"""" DB Session """


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from screener.config import get_database_url

engine = create_engine(
    get_database_url(),
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)
