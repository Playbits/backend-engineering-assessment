from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingRead
from app.services import briefing_service
from app.services.report_formatter import ReportFormatter

router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def create_briefing(payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = briefing_service.create_briefing(db, payload)
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}", response_model=BriefingRead)
def get_briefing(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}/report")
def get_briefing_report(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")

    formatter = ReportFormatter()
    # In a real app, we'd have a specific render_briefing method
    # For now, let's use a placeholder or implement it in ReportFormatter
    html_content = formatter.render_briefing(briefing)
    return Response(content=html_content, media_type="text/html")
