"""Tests for extended API endpoints: dashboard, system, jobs, reports upload, stock & portfolio CRUD"""

import pytest
from fastapi.testclient import TestClient

from api.main import app
from screener.db.base import Base
from screener.db.session import engine


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"X-API-KEY": "test-api-key"}


def test_system_status_and_dashboard_summary(client, auth_headers):
    # System status
    resp = client.get("/system/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "mock" in data["available_providers"]

    # Dashboard summary empty
    resp = client.get("/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["portfolios_count"] == 0
    assert summary["stocks_count"] == 0


def test_stock_extended_endpoints(client, auth_headers):
    # 1. Resolve preview
    resp = client.post("/stocks/resolve?query=AAPL", headers=auth_headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["resolved"] is True
    assert res["ticker"] == "AAPL"

    # 2. Create stock
    resp = client.post("/stocks", json={"ticker": "AAPL", "name": "Apple Inc."}, headers=auth_headers)
    assert resp.status_code == 201
    stock = resp.json()
    stock_id = stock["id"]

    # 3. Patch stock
    resp = client.patch(
        f"/stocks/{stock_id}",
        json={"sector": "Technology", "country": "US"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["sector"] == "Technology"
    assert resp.json()["country"] == "US"

    # 4. Sync all stocks
    resp = client.post("/stocks/sync-all", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["synced_count"] >= 1

    # 5. Delete stock
    resp = client.delete(f"/stocks/{stock_id}", headers=auth_headers)
    assert resp.status_code == 204

    resp = client.get(f"/stocks/{stock_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_portfolio_extended_endpoints(client, auth_headers):
    # Create portfolio
    resp = client.post(
        "/portfolios",
        json={"name": "Tech Depot", "currency": "EUR"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    p_id = resp.json()["id"]

    # Patch portfolio
    resp = client.patch(
        f"/portfolios/{p_id}",
        json={"name": "Tech Growth Depot"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Tech Growth Depot"

    # Add holding
    resp = client.post(
        f"/portfolios/{p_id}/holdings",
        json={
            "ticker": "MSFT",
            "name": "Microsoft Corp.",
            "shares": 10.0,
            "average_buy_price": 300.0,
            "currency": "EUR",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    holding_id = resp.json()["id"]
    stock_id = resp.json()["stock_id"]

    # Add transaction
    resp = client.post(
        f"/portfolios/{p_id}/transactions",
        json={
            "stock_id": stock_id,
            "transaction_type": "BUY",
            "shares": 5.0,
            "price_per_share": 310.0,
            "total_amount": 1550.0,
            "fees": 2.50,
            "currency": "EUR",
            "notes": "Nachkauf",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["transaction_type"] == "BUY"

    # Summary
    resp = client.get(f"/portfolios/{p_id}/summary", headers=auth_headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["name"] == "Tech Growth Depot"
    assert summary["positions_count"] == 1
    assert len(summary["top_holdings"]) == 1

    # Delete holding
    resp = client.delete(f"/portfolios/{p_id}/holdings/{holding_id}", headers=auth_headers)
    assert resp.status_code == 204


def test_reports_and_jobs_endpoints(client, auth_headers):
    # Create a stock
    resp = client.post("/stocks", json={"ticker": "SAP", "name": "SAP SE"}, headers=auth_headers)
    assert resp.status_code == 201
    stock_id = resp.json()["id"]

    # Upload report
    file_content = b"SAP SE Annual Report 2024. Revenue reached 31200 million. Operating income is 6500 million."
    files = {"file": ("sap_annual_2024.txt", file_content, "text/plain")}
    data = {
        "stock_id": stock_id,
        "report_type": "ANNUAL_REPORT",
        "fiscal_year": 2024,
        "title": "SAP FY24 Report",
        "auto_analyze": True,
    }
    resp = client.post("/reports/upload", data=data, files=files, headers=auth_headers)
    assert resp.status_code == 201
    report = resp.json()
    report_id = report["id"]
    assert len(report["analyses"]) > 0

    # List reports
    resp = client.get("/reports", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # Trigger stock analysis
    resp = client.post(f"/analyses/stocks/{stock_id}", headers=auth_headers)
    assert resp.status_code == 202

    # List jobs
    resp = client.get("/analyses/jobs", headers=auth_headers)
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) >= 1
    job_id = jobs[0]["id"]

    # Re-run job
    resp = client.post(f"/analyses/jobs/{job_id}/run", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "COMPLETED"

    # Run pending
    resp = client.post("/analyses/run-pending", headers=auth_headers)
    assert resp.status_code == 200

    # Delete report
    resp = client.delete(f"/reports/{report_id}", headers=auth_headers)
    assert resp.status_code == 204
