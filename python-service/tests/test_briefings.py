from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.briefing import Briefing  # noqa: F401


@pytest.fixture()
def client() -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
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


def test_create_and_get_briefing_report(client: TestClient) -> None:
    payload = {
        "companyName": "Acme Holdings",
        "ticker": "ACME",
        "sector": "Industrial Technology",
        "analystName": "Jane Doe",
        "summary": "Acme is doing well.",
        "recommendation": "Buy",
        "keyPoints": ["Growth is high", "Margins are expanding"],
        "risks": ["Competition"],
        "metrics": [
            {"name": "Revenue Growth", "value": "18%"},
            {"name": "P/E Ratio", "value": "28x"}
        ]
    }

    # 1. Create briefing
    create_response = client.post("/briefings", json=payload)
    assert create_response.status_code == 201
    created_data = create_response.json()
    assert created_data["companyName"] == "Acme Holdings"
    assert created_data["ticker"] == "ACME"
    briefing_id = created_data["id"]

    # 2. Get briefing details
    get_response = client.get(f"/briefings/{briefing_id}")
    assert get_response.status_code == 200
    assert get_response.json()["analystName"] == "Jane Doe"

    # 3. Get HTML report
    report_response = client.get(f"/briefings/{briefing_id}/report")
    assert report_response.status_code == 200
    assert report_response.headers["content-type"] == "text/html; charset=utf-8"
    assert "Briefing Report: Acme Holdings" in report_response.text
    assert "ACME" in report_response.text
    assert "Revenue Growth" in report_response.text
