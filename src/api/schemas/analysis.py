from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class AnalysisJobCreate(BaseModel):
    stock_id: int | None = Field(default=None, description="Stock ID for stock analysis")
    portfolio_id: int | None = Field(default=None, description="Portfolio ID for portfolio analysis")
    execute_sync: bool = Field(default=True, description="Whether to execute synchronously or queue for background worker")


class AnalysisJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_type: str
    stock_id: int | None = None
    portfolio_id: int | None = None
    status: str
    error_message: str | None = None
    params: dict[str, Any] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None


class AnalysisResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int | None = None
    stock_id: int | None = None
    portfolio_id: int | None = None
    version: int
    analysis_type: str
    headline: str | None = None
    score: float | None = None
    summary: str | None = None
    details: dict[str, Any]
    data_gaps: list[Any] | None = None
    uncertainties: list[Any] | None = None
    data_sources: list[Any] | None = None
    data_timestamp: datetime | None = None
    created_at: datetime | None = None
