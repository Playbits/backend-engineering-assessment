from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.briefing import BriefingCreate, BriefingRead
from app.services import briefing_service

router = APIRouter(prefix="/briefings", tags=["briefings"])


@router.post("", response_model=BriefingRead, status_code=status.HTTP_201_CREATED)
def create_briefing(payload: BriefingCreate, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    """
    Creates a new strategic briefing.
    
    Validates input data, including ticker normalization and minimum requirement checks
    for key points and risks. Handles database persistence for the main record and
    associated items.
    """
    try:
        briefing = briefing_service.create_briefing(db, payload)
        return BriefingRead.model_validate(briefing)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{briefing_id}", response_model=BriefingRead)
def get_briefing(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    """
    Retrieves a single briefing by ID.
    
    Includes all associated key points, risks, and metrics.
    """
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.post("/{briefing_id}/generate", response_model=BriefingRead)
def generate_briefing_report(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> BriefingRead:
    """
    Triggers HTML report generation for a briefing.
    
    Transforms the database records into a view model, renders the HTML using
    server-side templates, and persists the generated content.
    """
    briefing = briefing_service.generate_report(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    return BriefingRead.model_validate(briefing)


@router.get("/{briefing_id}/html")
def get_briefing_html(briefing_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    """
    Returns the rendered HTML content of a briefing report.
    
    Requires the report to have been previously generated via the /generate endpoint.
    Returns 400 if the report is not yet generated.
    """
    briefing = briefing_service.get_briefing(db, briefing_id)
    if not briefing:
        raise HTTPException(status_code=404, detail="Briefing not found")
    
    if not briefing.is_generated or not briefing.generated_html:
        raise HTTPException(status_code=400, detail="Report has not been generated yet")

    return Response(content=briefing.generated_html, media_type="text/html")
