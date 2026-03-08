from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingRead
from app.services import briefing_service

router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def create_briefing(payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    try:
        briefing = briefing_service.create_briefing(db, payload)
        return BriefingRead.model_validate(briefing)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{briefing_id}", response_model=BriefingRead)
def get_briefing(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.post("/{briefing_id}/generate", response_model=BriefingRead)
def generate_briefing_report(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    briefing = briefing_service.generate_report(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}/html")
def get_briefing_html(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    
    if not briefing.is_generated or not briefing.generated_html:
        raise HTTPException(status_code=400, detail="Report has not been generated yet")

    return Response(content=briefing.generated_html, media_type="text/html")
