"""Tests for the Stock Agent API"""

from pathlib import Path
import pytest
import yaml
from fastapi.testclient import TestClient

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
    response = client.get("/stocks")
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing X-API-KEY header."


def test_auth_middleware_invalid_key(client):
    """Test protected route returns 401 when X-API-KEY is invalid."""
    response = client.get("/stocks", headers={"X-API-KEY": "wrong-key"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing X-API-KEY header."


def test_validation_middleware_invalid_content_type(client):
    """Test POST request with non-json content-type returns 415."""
    response = client.post(
        "/stocks",
        headers={"X-API-KEY": "test-api-key", "Content-Type": "text/plain"},
        content="plain text body",
    )
    assert response.status_code == 415
    assert "Content-Type" in response.json()["detail"]


def test_create_and_list_stocks(client):
    """Test creating and listing stocks with valid authentication and payload."""
    payload = {
        "isin": "US0378331005",
        "wkn": "865985",
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "exchange": "NASDAQ",
        "currency": "USD",
    }
    response = client.post("/stocks", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 201
    data = response.json()
    assert data["isin"] == "US0378331005"
    assert data["wkn"] == "865985"
    assert data["ticker"] == "AAPL"

    # Test listing
    list_response = client.get("/stocks", headers=AUTH_HEADERS)
    assert list_response.status_code == 200
    stocks = list_response.json()
    assert len(stocks) >= 1
    assert any(s["isin"] == "US0378331005" for s in stocks)


def test_create_stock_existing_returns_existing(client):
    """Test submitting identical ISIN returns the existing stock."""
    payload = {
        "isin": "US0378331005",
        "name": "Apple Inc. Updated",
    }
    # First create
    res1 = client.post("/stocks", json=payload, headers=AUTH_HEADERS)
    assert res1.status_code == 201

    # Second create with same ISIN returns existing
    res2 = client.post("/stocks", json=payload, headers=AUTH_HEADERS)
    assert res2.status_code == 201
    assert res2.json()["isin"] == "US0378331005"


def test_create_stock_missing_isin_and_wkn(client):
    """Test validation when neither ISIN nor WKN is provided."""
    payload = {"name": "No Identifier"}
    response = client.post("/stocks", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 422


def test_main_yaml_openapi_spec():
    """Test that src/api/main.yaml exists, is valid YAML, and contains OpenAPI schema."""
    yaml_path = Path(__file__).parent.parent / "src" / "api" / "main.yaml"
    assert yaml_path.exists()
    content = yaml.safe_load(yaml_path.read_text())
    assert content["openapi"].startswith("3.")
    assert content["info"]["title"] == "Stock Screener API"
    assert "/stocks" in content["paths"]
    assert "/healthcheck" in content["paths"]
    assert "ApiKeyAuth" in content["components"]["securitySchemes"]
