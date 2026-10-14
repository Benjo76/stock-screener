""" Tests for the Stock Agent API """

import os
import pytest
from fastapi.testclient import TestClient

# Ensure test environment uses memory sqlite
os.environ["APP_ENV"] = "test"
os.environ["API_KEY"] = "test-api-key"

from api.main import app
from screener.db.base import Base
from screener.db.session import engine

AUTH_HEADERS = {"X-API-KEY": "test-api-key"}


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    """Test the healthcheck endpoint without authentication."""
    response = client.get("/healthcheck")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "stock-agent"


def test_db_health_endpoint(client):
    """Test the database healthcheck endpoint without authentication."""
    response = client.get("/healthcheck/db")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["database"] == "connected"


def test_openapi_specs(client):
    """Test that OpenAPI schema contains security scheme and routes."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert "components" in schema
    assert "securitySchemes" in schema["components"]
    assert "ApiKeyAuth" in schema["components"]["securitySchemes"]
    assert schema["components"]["securitySchemes"]["ApiKeyAuth"]["name"] == "X-API-KEY"


def test_auth_middleware_missing_key(client):
    """Test protected route returns 401 when X-API-KEY is missing."""
    response = client.get("/securities")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing X-API-KEY header."


def test_auth_middleware_invalid_key(client):
    """Test protected route returns 401 when X-API-KEY is invalid."""
    response = client.get("/securities", headers={"X-API-KEY": "wrong-key"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing X-API-KEY header."


def test_validation_middleware_invalid_content_type(client):
    """Test POST request with non-json content-type returns 415."""
    response = client.post(
        "/securities",
        headers={"X-API-KEY": "test-api-key", "Content-Type": "text/plain"},
        content="plain text body",
    )
    assert response.status_code == 415
    assert "Content-Type" in response.json()["detail"]


def test_create_and_list_securities(client):
    """Test creating and listing securities with valid authentication and payload."""
    payload = {
        "isin": "US0378331005",
        "wkn": "865985",
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
    }
    response = client.post("/securities", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert data["isin"] == "US0378331005"
    assert data["wkn"] == "865985"
    assert data["ticker"] == "AAPL"

    # Test listing
    list_response = client.get("/securities", headers=AUTH_HEADERS)
    assert list_response.status_code == 200
    securities = list_response.json()
    assert len(securities) >= 1
    assert any(s["isin"] == "US0378331005" for s in securities)


def test_create_security_existing_returns_existing(client):
    """Test submitting identical ISIN returns the existing security."""
    payload = {
        "isin": "US0378331005",
        "name": "Apple Inc. Updated",
    }
    # First create
    res1 = client.post("/securities", json=payload, headers=AUTH_HEADERS)
    assert res1.status_code == 201

    # Second create with same ISIN returns existing
    res2 = client.post("/securities", json=payload, headers=AUTH_HEADERS)
    assert res2.status_code == 201
    assert res2.json()["isin"] == "US0378331005"


def test_create_security_missing_isin_and_wkn(client):
    """Test validation when neither ISIN nor WKN is provided."""
    payload = {"name": "No Identifier"}
    response = client.post("/securities", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422
