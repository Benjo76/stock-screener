"""Configuration"""

import os
import sys


def get_database_url() -> str:
    """Get database url"""
    url = os.getenv("DATABASE_URL")
    if url:
        return url

    if os.getenv("APP_ENV") == "test" or "pytest" in sys.modules or os.getenv("PYTEST_CURRENT_TEST"):
        return "sqlite:///:memory:"

    user = os.getenv("POSTGRES_USER")
    password = os.getenv("POSTGRES_PASSWORD")
    db = os.getenv("POSTGRES_DB")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")

    if user and password and db:
        return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{db}"

    raise RuntimeError("DATABASE_URL is not configured")
