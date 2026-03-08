from sqlalchemy.orm import Session

from app.models.briefing import Briefing
from app.schemas.briefing import BriefingCreate


def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    db_briefing = Briefing(
        company_name=payload.company_name,
        ticker=payload.ticker,
        sector=payload.sector,
        analyst_name=payload.analyst_name,
        summary=payload.summary,
        recommendation=payload.recommendation,
        key_points=payload.key_points,
        risks=payload.risks,
        metrics=[m.model_dump() for m in payload.metrics] if payload.metrics else None,
    )
    db.add(db_briefing)
    db.commit()
    db.refresh(db_briefing)
    return db_briefing


def get_briefing(db: Session, briefing_id: int) -> Briefing | None:
    return db.query(Briefing).filter(Briefing.id == briefing_id).first()
