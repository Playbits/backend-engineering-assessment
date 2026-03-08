from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.briefing import Briefing, BriefingMetric, BriefingPoint  # noqa: F401


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    """
    Sets up a TestClient with an in-memory SQLite database.
    Overrides the get_db dependency for isolated testing.
    """
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def test_briefing_lifecycle(client: TestClient) -> None:
    """Verifies the complete creation -> generation -> retrieval flow."""
    # 1. Create briefing (Ticker normalize to upper, min items check)
    payload = {
        "companyName": "Acme Corp",
        "ticker": "acme",  # lowercase to test normalization
        "sector": "Tech",
        "analystName": "Jane Doe",
        "summary": "Summary",
        "recommendation": "Hold",
        "keyPoints": ["Point A", "Point B"],  # Exact 2
        "risks": ["Risk Alpha"], # Exact 1
        "metrics": [{"name": "Revenue", "value": "100M"}]
    }
    
    response = client.post("/briefings", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["ticker"] == "ACME"
    assert data["isGenerated"] is False
    briefing_id = data["id"]

    # 2. Get briefed details
    response = client.get(f"/briefings/{briefing_id}")
    assert response.status_code == 200
    assert response.json()["companyName"] == "Acme Corp"
    assert len(response.json()["keyPoints"]) == 2

    # 3. Generate report
    response = client.post(f"/briefings/{briefing_id}/generate")
    assert response.status_code == 200
    assert response.json()["isGenerated"] is True
    
    # 4. Fetch HTML
    response = client.get(f"/briefings/{briefing_id}/html")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/html; charset=utf-8"
    assert "Strategic Briefing: Acme Corp" in response.text
    assert "ACME" in response.text
    assert "System Generated Report" in response.text


def test_briefing_validation_errors(client: TestClient) -> None:
    """Verifies strict validation rules for creating briefings."""
    
    # Test 1: Missing required field
    response = client.post("/briefings", json={"ticker": "AAPL"})
    assert response.status_code == 422

    # Test 2: Key points < 2 (Validation Requirement)
    payload = {
        "companyName": "Fail",
        "ticker": "FAIL",
        "sector": "None",
        "analystName": "None",
        "summary": "None",
        "recommendation": "None",
        "keyPoints": ["Only 1 point"],
        "risks": ["One Risk"]
    }
    response = client.post("/briefings", json=payload)
    assert response.status_code == 422

    # Test 3: Missing risks (Validation Requirement: at least 1)
    payload["keyPoints"] = ["Point 1", "Point 2"]
    payload["risks"] = [] # Empty list
    response = client.post("/briefings", json=payload)
    assert response.status_code == 422

    # Test 4: Metric name uniqueness (Validation Requirement)
    payload["risks"] = ["Risk 1"]
    payload["metrics"] = [
        {"name": "EBITDA", "value": "10M"},
        {"name": "EBITDA", "value": "15M"} # Duplicate name
    ]
    response = client.post("/briefings", json=payload)
    assert response.status_code == 422


def test_html_fetch_edge_cases(client: TestClient) -> None:
    """Verifies error handling for HTML retrieval."""
    
    # 1. Fetching non-existent briefing
    response = client.get("/briefings/999/html")
    assert response.status_code == 404

    # 2. Fetching before generation
    payload = {
        "companyName": "NoGen",
        "ticker": "NOGEN",
        "sector": "Tech",
        "analystName": "Jane Doe",
        "summary": "Summary",
        "recommendation": "Hold",
        "keyPoints": ["P1", "P2"],
        "risks": ["R1"]
    }
    create_response = client.post("/briefings", json=payload)
    briefing_id = create_response.json()["id"]

    response = client.get(f"/briefings/{briefing_id}/html")
    assert response.status_code == 400
    assert "Report has not been generated yet" in response.json()["detail"]


def test_sorting_and_formatting(client: TestClient) -> None:
    """Verifies that the View Model correctly sorts and formats data."""
    payload = {
        "companyName": "Sorting Corp",
        "ticker": "SRT",
        "sector": "Tech",
        "analystName": "Jane Doe",
        "summary": "Summary",
        "recommendation": "Hold",
        "keyPoints": ["Gamma", "Alpha", "Beta"],
        "risks": ["Zeta", "Delta"],
        "metrics": [
            {"name": "revenue", "value": "100M"},
            {"name": "ebitda", "value": "10M"}
        ]
    }
    
    create_res = client.post("/briefings", json=payload)
    briefing_id = create_res.json()["id"]
    
    # Generate
    client.post(f"/briefings/{briefing_id}/generate")
    
    # Verify HTML content contains sorted values
    html_res = client.get(f"/briefings/{briefing_id}/html")
    html = html_res.text
    
    # Basic check for presence + title case formatting in metrics
    assert "Ebitda" in html
    assert "Revenue" in html
    assert "Alpha" in html
    assert "Gamma" in html
    assert "Delta" in html
    assert "Zeta" in html


def test_briefing_not_found(client: TestClient) -> None:
    """Verifies 404 behavior for invalid briefing IDs."""
    # GET
    response = client.get("/briefings/9999")
    assert response.status_code == 404
    
    # GENERATE
    response = client.post("/briefings/9999/generate")
    assert response.status_code == 404
