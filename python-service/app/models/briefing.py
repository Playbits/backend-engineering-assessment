from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Briefing(Base):
    """
    Main briefing entity storing company info and generation state.
    Key points, risks, and metrics are stored in separate normalized tables.
    """
    __tablename__ = "briefings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    sector: Mapped[str] = mapped_column(String(120), nullable=False)
    analyst_name: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    
    # Report Generation State
    is_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    generated_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships (One-to-Many)
    points: Mapped[list["BriefingPoint"]] = relationship(
        "BriefingPoint", back_populates="briefing", cascade="all, delete-orphan"
    )
    metrics: Mapped[list["BriefingMetric"]] = relationship(
        "BriefingMetric", back_populates="briefing", cascade="all, delete-orphan"
    )

    @property
    def key_points(self) -> list[str]:
        """Convenience property to access key points directly."""
        return [p.content for p in self.points if p.type == "key_point"]

    @property
    def risks(self) -> list[str]:
        """Convenience property to access risks directly."""
        return [p.content for p in self.points if p.type == "risk"]


class BriefingPoint(Base):
    """Stores individual key points or risks for a briefing."""
    __tablename__ = "briefing_points"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    
    # 'key_point' or 'risk'
    type: Mapped[str] = mapped_column(String(20), nullable=False) 

    briefing: Mapped["Briefing"] = relationship("Briefing", back_populates="points")


class BriefingMetric(Base):
    """Stores individual financial/key metrics for a briefing."""
    __tablename__ = "briefing_metrics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    briefing_id: Mapped[int] = mapped_column(ForeignKey("briefings.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(50), nullable=False)

    briefing: Mapped["Briefing"] = relationship("Briefing", back_populates="metrics")
