from sqlalchemy.orm import Session
from app.models.briefing import Briefing, BriefingMetric, BriefingPoint
from app.schemas.briefing import BriefingCreate, BriefingReportViewModel
from app.services.report_formatter import ReportFormatter

def create_briefing(db: Session, payload: BriefingCreate) -> Briefing:
    """
    Creates a new briefing and its associated points and metrics in the database.
    
    This function handles the normalization of data by storing key points and risks
    in a dedicated 'briefing_points' table with a discriminator type.
    """
    # 1. Create main briefing record
    db_briefing = Briefing(
        company_name=payload.company_name,
        ticker=payload.ticker,
        sector=payload.sector,
        analyst_name=payload.analyst_name,
        summary=payload.summary,
        recommendation=payload.recommendation,
    )
    db.add(db_briefing)
    db.flush()  # Generate ID for foreign keys

    # 2. Add Key Points and Risks (Normalized storage)
    for point in payload.key_points:
        db.add(BriefingPoint(briefing_id=db_briefing.id, content=point, type="key_point"))

    for risk in payload.risks:
        db.add(BriefingPoint(briefing_id=db_briefing.id, content=risk, type="risk"))

    # 3. Add Optional Metrics
    if payload.metrics:
        for metric in payload.metrics:
            db.add(
                BriefingMetric(
                    briefing_id=db_briefing.id,
                    name=metric.name,
                    value=metric.value,
                )
            )

    db.commit()
    db.refresh(db_briefing)
    return db_briefing

def get_briefing(db: Session, briefing_id: int) -> Briefing | None:
    """
    Retrieves a briefing by its ID, including related points and metrics.
    Returns None if the briefing is not found.
    """
    return db.query(Briefing).filter(Briefing.id == briefing_id).first()

def transform_to_view_model(briefing: Briefing) -> BriefingReportViewModel:
    """
    Transforms a Briefing ORM model into a display-ready View Model.
    
    This encapsulates all presentational formatting logic, such as sorting points,
    title-casing metric labels, and generating human-readable titles/timestamps.
    Ensures the template remains clean and focused solely on structure.
    """
    from datetime import datetime, timezone

    # Formatting logic: Sorting points for professional presentation
    key_points = sorted([p.content for p in briefing.points if p.type == "key_point"])
    risks = sorted([p.content for p in briefing.points if p.type == "risk"])
    
    # Formatting logic: Sorting and title-casing metric labels
    metrics = []
    if briefing.metrics:
        sorted_metrics = sorted(briefing.metrics, key=lambda m: m.name)
        metrics = [{"label": m.name.title(), "value": m.value} for m in sorted_metrics]

    # Generate localized/formatted generation timestamp
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    return BriefingReportViewModel(
        report_title=f"Strategic Briefing: {briefing.company_name} ({briefing.ticker})",
        company_display=f"{briefing.company_name} ({briefing.ticker})",
        analyst_display=f"Prepared by {briefing.analyst_name}",
        date_display=briefing.created_at.strftime("%B %d, %Y"),
        summary=briefing.summary,
        recommendation=briefing.recommendation,
        key_points=key_points,
        risks=risks,
        metrics=metrics,
        footer_text=f"System Generated Report • {generated_at}",
    )

def generate_report(db: Session, briefing_id: int) -> Briefing | None:
    """
    Triggers the report generation for a briefing.
    Transforms data to a view model, renders HTML, and persists it.
    """
    briefing = get_briefing(db, briefing_id)
    if not briefing:
        return None

    # Step 1: Transform to View Model (Separation of Concerns)
    view_model = transform_to_view_model(briefing)

    # Step 2: Render via server-side template
    formatter = ReportFormatter()
    html_content = formatter.render_briefing(view_model)

    # Step 3: Persist generation state
    briefing.generated_html = html_content
    briefing.is_generated = True

    db.commit()
    db.refresh(briefing)
    return briefing
