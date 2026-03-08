from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class BriefingMetricSchema(BaseModel):
    """Schema for individual metrics within a briefing."""
    model_config = ConfigDict(from_attributes=True)

    name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=50)


class BriefingCreate(BaseModel):
    """
    Schema for creating a new briefing.
    Includes comprehensive validation for assessment requirements.
    """
    model_config = ConfigDict(populate_by_name=True)

    company_name: str = Field(validation_alias="companyName", min_length=1, max_length=255)
    ticker: str = Field(min_length=1, max_length=20)
    sector: str = Field(min_length=1, max_length=120)
    analyst_name: str = Field(validation_alias="analystName", min_length=1, max_length=120)
    summary: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    
    # Constraint: At least 2 key points
    key_points: list[str] = Field(validation_alias="keyPoints", min_length=2)
    
    # Constraint: At least 1 risk
    risks: list[str] = Field(min_length=1)
    
    metrics: list[BriefingMetricSchema] | None = Field(default=None)

    @field_validator("ticker")
    @classmethod
    def ticker_must_be_uppercase(cls, v: str) -> str:
        """Enforces uppercase ticker symbols."""
        return v.upper()

    @model_validator(mode="after")
    def validate_unique_metrics(self) -> "BriefingCreate":
        """Enforces unique metric names within the same briefing."""
        if self.metrics:
            names = [m.name for m in self.metrics]
            if len(names) != len(set(names)):
                raise ValueError("Metric names must be unique within a briefing")
        return self


class BriefingRead(BaseModel):
    """
    Schema for reading briefing data.
    Uses validation_alias and serialization_alias for flexible mapping.
    Representing the structured JSON view of a briefing.
    """
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    company_name: str = Field(validation_alias="company_name", serialization_alias="companyName")
    ticker: str
    sector: str
    analyst_name: str = Field(validation_alias="analyst_name", serialization_alias="analystName")
    summary: str
    recommendation: str
    
    # Maps directly to @property on Briefing ORM model
    key_points: list[str] = Field(validation_alias="key_points", serialization_alias="keyPoints")
    risks: list[str] = Field(validation_alias="risks")
    
    metrics: list[BriefingMetricSchema] | None
    is_generated: bool = Field(validation_alias="is_generated", serialization_alias="isGenerated")
    created_at: datetime


class BriefingReportViewModel(BaseModel):
    """
    View Model dedicated to the HTML Template.
    Ensures complete separation of concerns by passing pre-formatted values.
    """
    report_title: str
    company_display: str
    analyst_display: str
    date_display: str
    summary: str
    recommendation: str
    key_points: list[str]
    risks: list[str]
    metrics: list[dict[str, str]]
    footer_text: str
