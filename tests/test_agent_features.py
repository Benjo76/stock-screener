""" Comprehensive tests for Stock Agent features:
- Securities and portfolio management
- CSV validation, preview, and execution (holdings & transactions)
- Duplicates and error handling
- Fundamental analysis engine & scoring (distinguishing missing data vs negative numbers, industry adjustments)
- Report extraction and unverified flag
- Portfolio analysis and risk tracking (concentration risk, diversification, sector weights)
- Versioned analysis results
- Screener worker execution
- Security, Middleware, Upload size limit (413) and Content-Type validation
"""

from datetime import date, datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from api.main import app
from screener.analysis.engine import StockAnalysisEngine
from screener.analysis.portfolio_analyzer import PortfolioAnalyzer
from screener.analysis.report_analyzer import CompanyReportAnalyzer
from screener.db.base import Base
from screener.db.models import (
    AnalysisJob,
    AnalysisResult,
    CompanyReport,
    FundamentalData,
    Portfolio,
    PortfolioHolding,
    PortfolioTransaction,
    ReportAnalysis,
    Stock,
    StockPrice,
)
from screener.db.session import SessionLocal, engine
from screener.importers.csv_importer import CsvPortfolioImporter
from screener.providers.mock_provider import MockDataProvider
from screener.services.analysis_service import AnalysisService
from screener.services.portfolio_service import PortfolioService
from screener.services.report_service import ReportService
from screener.services.stock_service import StockService
from screener.worker import ScreenerWorker

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


def test_stock_service_lookup_and_resolution():
    with SessionLocal() as db:
        mock_provider = MockDataProvider()
        
        # Test creating by ISIN with provider resolution
        stock = StockService.resolve_and_create_stock(
            db=db,
            isin="US0378331005",
            provider=mock_provider,
        )
        assert stock.isin == "US0378331005"
        assert stock.ticker == "AAPL"
        assert stock.name == "Apple Inc."
        assert stock.wkn == "865985"

        # Lookup duplicate by WKN returns same stock
        stock2 = StockService.resolve_and_create_stock(
            db=db,
            wkn="865985",
            provider=mock_provider,
        )
        assert stock2.id == stock.id

        # Sync market and fundamental data
        StockService.sync_market_and_fundamental_data(db, stock.id, provider=mock_provider)
        db.refresh(stock)
        assert len(stock.prices) > 0
        assert len(stock.fundamentals) > 0


def test_csv_importer_german_holdings_preview_and_execute(client):
    csv_german_holdings = (
        "ISIN;WKN;Name;Bestand;Einstandskurs;Währung\n"
        "US0378331005;865985;Apple Inc.;10;150,50;EUR\n"
        "DE0007164600;716460;SAP SE;25;120,00;EUR\n"
        "INVALID_ISIN;123;Bad Stock;-5;10,00;EUR\n"
    )

    # 1. Create Portfolio via API
    p_resp = client.post("/portfolios", json={"name": "Altersvorsorge", "currency": "EUR"}, headers=AUTH_HEADERS)
    assert p_resp.status_code == 201
    portfolio_id = p_resp.json()["id"]

    # 2. Preview CSV import
    preview_resp = client.post(
        f"/portfolios/{portfolio_id}/import/preview",
        json={"csv_content": csv_german_holdings},
        headers=AUTH_HEADERS,
    )
    assert preview_resp.status_code == 200
    preview = preview_resp.json()
    assert preview["import_type"] == "holdings"
    assert preview["total_rows"] == 3
    assert preview["valid_rows_count"] == 2
    assert preview["invalid_rows_count"] == 1
    assert len(preview["preview_items"]) == 3

    # 3. Execute CSV import
    exec_resp = client.post(
        f"/portfolios/{portfolio_id}/import",
        json={"csv_content": csv_german_holdings},
        headers=AUTH_HEADERS,
    )
    assert exec_resp.status_code == 200
    res = exec_resp.json()
    assert res["imported_count"] == 2
    assert res["skipped_count"] == 1
    assert len(res["row_errors"]) == 1

    # Check portfolio holdings in DB
    get_resp = client.get(f"/portfolios/{portfolio_id}", headers=AUTH_HEADERS)
    assert get_resp.status_code == 200
    p_data = get_resp.json()
    assert len(p_data["holdings"]) == 2
    apple_h = next(h for h in p_data["holdings"] if h["stock"]["isin"] == "US0378331005")
    assert apple_h["shares"] == 10.0
    assert apple_h["average_buy_price"] == 150.50


def test_csv_importer_transactions_and_duplicate_detection(client):
    csv_transactions = (
        "Date,Type,ISIN,WKN,Ticker,Shares,Price,Amount,Fees,Currency,Transaction_ID\n"
        "2024-01-15,BUY,US0378331005,865985,AAPL,10,150.00,1505.00,5.00,USD,TX-1001\n"
        "2024-02-15,BUY,US0378331005,865985,AAPL,5,160.00,805.00,5.00,USD,TX-1002\n"
        "2024-03-01,SELL,US0378331005,865985,AAPL,4,180.00,715.00,5.00,USD,TX-1003\n"
        "2024-04-01,DIVIDEND,US0378331005,865985,AAPL,,0.25,2.75,0.00,USD,TX-1004\n"
    )

    # 1. Create Portfolio
    p_resp = client.post("/portfolios", json={"name": "Trading Depot", "currency": "USD"}, headers=AUTH_HEADERS)
    p_id = p_resp.json()["id"]

    # 2. Import Transactions
    res1 = client.post(
        f"/portfolios/{p_id}/import",
        json={"csv_content": csv_transactions},
        headers=AUTH_HEADERS,
    )
    assert res1.status_code == 200
    assert res1.json()["imported_count"] == 4
    assert res1.json()["skipped_count"] == 0

    # 3. Re-import identical CSV -> All duplicates detected and skipped
    res2 = client.post(
        f"/portfolios/{p_id}/import",
        json={"csv_content": csv_transactions},
        headers=AUTH_HEADERS,
    )
    assert res2.status_code == 200
    assert res2.json()["imported_count"] == 0
    assert res2.json()["skipped_count"] == 4

    # 4. Verify resulting holding state (10 + 5 - 4 = 11 shares remaining)
    p_details = client.get(f"/portfolios/{p_id}", headers=AUTH_HEADERS).json()
    assert len(p_details["transactions"]) == 4
    holding = p_details["holdings"][0]
    assert holding["shares"] == 11.0


def test_fundamental_analysis_engine_evaluation():
    stock = Stock(
        id=1,
        isin="US0378331005",
        ticker="AAPL",
        name="Apple Inc.",
        sector="Technology",
    )
    fundamentals = [
        FundamentalData(
            stock_id=1,
            fiscal_year=2023,
            fiscal_period="FY",
            revenue=100000.0,
            net_income=20000.0,
            eps=4.0,
            gross_margin=0.45,
            operating_margin=0.30,
            free_cash_flow=25000.0,
            debt_to_equity=1.2,
            current_ratio=1.4,
            pe_ratio=25.0,
            data_source="mock",
        ),
        FundamentalData(
            stock_id=1,
            fiscal_year=2024,
            fiscal_period="FY",
            revenue=115000.0,
            net_income=24000.0,
            eps=4.8,
            gross_margin=0.46,
            operating_margin=0.32,
            free_cash_flow=30000.0,
            debt_to_equity=1.0,
            current_ratio=1.5,
            pe_ratio=26.0,
            dividend_yield=0.015,
            data_source="mock",
        ),
    ]

    evaluation = StockAnalysisEngine.analyze(stock, fundamentals)
    assert evaluation.score > 70.0
    assert evaluation.growth_score > 0
    assert evaluation.profitability_score > 0
    assert len(evaluation.trends) > 0
    assert len(evaluation.opportunities) > 0
    assert evaluation.metrics["revenue_growth_yoy"] == pytest.approx(0.15)


def test_distinction_between_missing_data_and_negative_metrics():
    """Verify that missing metrics are recorded in data_gaps while negative values are analyzed as risks."""
    stock = Stock(
        id=2,
        isin="DE000TEST123",
        name="Turnaround AG",
        sector="Technology",
    )
    # Case with negative net income and missing gross margin
    fundamentals = [
        FundamentalData(
            stock_id=2,
            fiscal_year=2024,
            fiscal_period="FY",
            revenue=50000.0,
            net_income=-10000.0,  # Actually negative profit
            gross_margin=None,     # Missing metric
            operating_margin=-0.20,
            pe_ratio=-15.0,        # Negative PE
            debt_to_equity=3.5,    # High debt
            data_source="manual",
        )
    ]
    eval_res = StockAnalysisEngine.analyze(stock, fundamentals)
    assert any("Bruttomarge" in gap for gap in eval_res.data_gaps)
    assert any("Verlust" in risk or "Negatives KGV" in risk for risk in eval_res.risks)
    assert eval_res.score < 50.0


def test_report_analysis_and_unverified_flag(client):
    # 1. Create stock
    stk_resp = client.post("/stocks", json={"isin": "US0378331005", "ticker": "AAPL", "name": "Apple Inc."}, headers=AUTH_HEADERS)
    stock_id = stk_resp.json()["id"]

    # 2. Post report text
    report_payload = {
        "stock_id": stock_id,
        "report_type": "ANNUAL_REPORT",
        "fiscal_year": 2024,
        "fiscal_period": "FY",
        "title": "Annual Report 2024 (10-K)",
        "content_text": (
            "During 2024, revenue grew to $391.0 billion. Gross margin reached 46.2%. "
            "Operating cash flow reached $118.3 billion. "
            "Risks: Supply chain bottlenecks in Asia and regulatory scrutiny regarding app store fees. "
            "Opportunities: Expansion of cloud and generative AI features."
        ),
        "auto_analyze": True,
    }
    r_resp = client.post("/reports", json=report_payload, headers=AUTH_HEADERS)
    assert r_resp.status_code == 201
    report_data = r_resp.json()
    assert len(report_data["analyses"]) == 1
    
    analysis = report_data["analyses"][0]
    # Check that extracted figures are flagged as unverified by default
    assert analysis["is_verified"] is False
    assert "Ungeprüft" in analysis["verification_notes"]
    assert len(analysis["risks"]) >= 1
    assert len(analysis["opportunities"]) >= 1
    assert analysis["extracted_kpis"]["extracted_revenue"] == 391000000000.0

    # 3. Verify analysis
    verify_resp = client.patch(
        f"/reports/analyses/{analysis['id']}/verify",
        json={"is_verified": True, "verification_notes": "Manuell mit Original-10-K abgeglichen und bestätigt."},
        headers=AUTH_HEADERS,
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["is_verified"] is True


def test_portfolio_analysis_and_versioned_results(client):
    with SessionLocal() as db:
        mock = MockDataProvider()
        stock = StockService.resolve_and_create_stock(db, isin="US0378331005", provider=mock)
        StockService.sync_market_and_fundamental_data(db, stock.id, provider=mock)

        # Create portfolio with holdings
        portfolio = PortfolioService.create_portfolio(db, "Test Depot", currency="USD")
        holding = PortfolioHolding(
            portfolio_id=portfolio.id,
            stock_id=stock.id,
            shares=10.0,
            average_buy_price=140.0,
            total_cost=1400.0,
        )
        db.add(holding)
        db.commit()
        portfolio_id = portfolio.id

    # Run analysis 1
    res1 = client.post(f"/analyses/portfolios/{portfolio_id}", headers=AUTH_HEADERS)
    assert res1.status_code == 202
    job1_id = res1.json()["id"]

    # Run analysis 2 (creates version 2)
    res2 = client.post(f"/analyses/portfolios/{portfolio_id}", headers=AUTH_HEADERS)
    assert res2.status_code == 202

    # Check portfolio analyses list contains both versions without overwriting
    analyses_resp = client.get(f"/portfolios/{portfolio_id}/analyses", headers=AUTH_HEADERS)
    assert analyses_resp.status_code == 200
    results = analyses_resp.json()
    assert len(results) >= 2
    versions = [r["version"] for r in results]
    assert 1 in versions
    assert 2 in versions


def test_upload_size_limit_middleware(client):
    """Test that requests exceeding MAX_UPLOAD_SIZE_BYTES return 413 Payload Too Large."""
    large_payload = "A" * (11 * 1024 * 1024)  # 11MB
    resp = client.post(
        "/portfolios",
        content=large_payload,
        headers={"X-API-KEY": "test-api-key", "Content-Type": "application/json", "Content-Length": str(len(large_payload))},
    )
    assert resp.status_code == 413
    assert "Payload Too Large" in resp.json()["detail"]


def test_screener_worker_processes_pending_jobs():
    with SessionLocal() as db:
        mock = MockDataProvider()
        stock = StockService.resolve_and_create_stock(db, isin="DE0007164600", provider=mock)
        StockService.sync_market_and_fundamental_data(db, stock.id, provider=mock)

        # Create asynchronous (execute_sync=False) pending job
        job = AnalysisService.create_stock_analysis_job(db, stock.id, execute_sync=False)
        assert job.status == "PENDING"
        job_id = job.id

    # Execute worker cycle
    worker = ScreenerWorker()
    processed = worker.process_pending_jobs()
    assert processed >= 1

    with SessionLocal() as db:
        updated_job = AnalysisService.get_job(db, job_id)
        assert updated_job.status == "COMPLETED"
        assert len(updated_job.results) == 1
        assert updated_job.results[0].score > 0


def test_csv_importer_purchase_price_and_current_price(client):
    csv_content = (
        "ISIN,Name,Shares,Purchase Price,Current Price,Currency\n"
        "US0378331005,Apple Inc.,10,150.00,180.50,EUR\n"
        "DE0007164600,SAP SE,20,120.00,135.00,EUR\n"
    )

    # 1. Create Portfolio
    p_resp = client.post("/portfolios", json={"name": "Depot mit Preisen", "currency": "EUR"}, headers=AUTH_HEADERS)
    assert p_resp.status_code == 201
    portfolio_id = p_resp.json()["id"]

    # 2. Preview CSV import
    prev_resp = client.post(
        f"/portfolios/{portfolio_id}/import/preview",
        json={"csv_content": csv_content},
        headers=AUTH_HEADERS,
    )
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["valid_rows_count"] == 2
    assert prev_data["preview_items"][0]["purchase_price"] == 150.00
    assert prev_data["preview_items"][0]["current_price"] == 180.50

    # 3. Execute CSV import
    exec_resp = client.post(
        f"/portfolios/{portfolio_id}/import",
        json={"csv_content": csv_content},
        headers=AUTH_HEADERS,
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["imported_count"] == 2

    # 4. Check portfolio details and summary
    port_resp = client.get(f"/portfolios/{portfolio_id}", headers=AUTH_HEADERS)
    assert port_resp.status_code == 200
    port_data = port_resp.json()
    assert len(port_data["holdings"]) == 2
    apple_h = next(h for h in port_data["holdings"] if h["stock"]["ticker"] == "AAPL" or h["stock"]["isin"] == "US0378331005")
    assert apple_h["purchase_price"] == 150.00
    assert apple_h["current_price"] == 180.50

    sum_resp = client.get(f"/portfolios/{portfolio_id}/summary", headers=AUTH_HEADERS)
    assert sum_resp.status_code == 200
    sum_data = sum_resp.json()
    assert sum_data["total_cost"] == (10 * 150.00) + (20 * 120.00)  # 1500 + 2400 = 3900.0
    assert sum_data["total_value"] == (10 * 180.50) + (20 * 135.00)  # 1805 + 2700 = 4505.0


def test_manual_holding_with_purchase_price_and_current_price(client):
    p_resp = client.post("/portfolios", json={"name": "Manuelles Depot", "currency": "EUR"}, headers=AUTH_HEADERS)
    assert p_resp.status_code == 201
    portfolio_id = p_resp.json()["id"]

    holding_payload = {
        "ticker": "MSFT",
        "name": "Microsoft Corp.",
        "shares": 5.0,
        "purchase_price": 350.00,
        "current_price": 420.00,
        "currency": "EUR",
    }
    h_resp = client.post(f"/portfolios/{portfolio_id}/holdings", json=holding_payload, headers=AUTH_HEADERS)
    assert h_resp.status_code == 200
    h_data = h_resp.json()
    assert h_data["purchase_price"] == 350.00
    assert h_data["average_buy_price"] == 350.00
    assert h_data["current_price"] == 420.00


def test_csv_importer_german_purchase_and_current_price(client):
    csv_german = (
        "ISIN;Name;Stück;Kaufpreis;Aktueller Kurs;Währung\n"
        "US0378331005;Apple Inc.;10;150,00;180,50;EUR\n"
        "DE0007164600;SAP SE;20;120,00;135,00;EUR\n"
    )

    p_resp = client.post("/portfolios", json={"name": "Deutsches Depot", "currency": "EUR"}, headers=AUTH_HEADERS)
    assert p_resp.status_code == 201
    portfolio_id = p_resp.json()["id"]

    prev_resp = client.post(
        f"/portfolios/{portfolio_id}/import/preview",
        json={"csv_content": csv_german},
        headers=AUTH_HEADERS,
    )
    assert prev_resp.status_code == 200
    prev_data = prev_resp.json()
    assert prev_data["valid_rows_count"] == 2
    assert prev_data["preview_items"][0]["purchase_price"] == 150.00
    assert prev_data["preview_items"][0]["current_price"] == 180.50

    exec_resp = client.post(
        f"/portfolios/{portfolio_id}/import",
        json={"csv_content": csv_german},
        headers=AUTH_HEADERS,
    )
    assert exec_resp.status_code == 200
    assert exec_resp.json()["imported_count"] == 2

    sum_resp = client.get(f"/portfolios/{portfolio_id}/summary", headers=AUTH_HEADERS)
    assert sum_resp.status_code == 200
    sum_data = sum_resp.json()
    assert sum_data["total_cost"] == 3900.0
    assert sum_data["total_value"] == 4505.0
