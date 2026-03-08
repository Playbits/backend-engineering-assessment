from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BriefingMetric(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=50)


class BriefingCreate(BaseModel):
    company_name: str = Field(alias="companyName", min_length=1, max_length=255)
    ticker: str = Field(min_length=1, max_length=20)
    sector: str = Field(min_length=1, max_length=120)
    analyst_name: str = Field(alias="analystName", min_length=1, max_length=120)
    summary: str = Field(min_length=1)
    recommendation: str = Field(min_length=1)
    key_points: list[str] = Field(alias="keyPoints", min_length=1)
    risks: list[str] = Field(min_length=1)
    metrics: list[BriefingMetric] | None = Field(default=None)

    model_config = ConfigDict(populate_by_name=True)


class BriefingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    company_name: str = Field(alias="companyName")
    ticker: str
    sector: str
    analyst_name: str = Field(alias="analystName")
    summary: str
    recommendation: str
    key_points: list[str] = Field(alias="keyPoints")
    risks: list[str]
    metrics: list[BriefingMetric] | None
    created_at: datetime
