from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional


class Recommendation(BaseModel):
    action: str = Field(..., description="Actionable item (e.g. bearing overhaul)")
    priority: str = Field(..., description="Action priority: critical, high, medium, low")
    description: str = Field(..., description="Detailed description of the issue and fix")


class HealthScoreResponse(BaseModel):
    machine_id: str
    machine_name: str
    health_score: float = Field(..., ge=0.0, le=100.0)
    failure_probability: float = Field(..., ge=0.0, le=1.0)
    remaining_useful_life_hours: float
    is_anomaly: bool
    anomaly_score: float
    predicted_failure_mode: str
    recommendations: List[Recommendation]
    telemetry_evaluations: Optional[dict] = None
    evaluated_at: datetime


class AnomalyDetail(BaseModel):
    timestamp: datetime
    metric: str
    value: float
    threshold: float
    z_score: float


class AnomalyDetectionResponse(BaseModel):
    machine_id: str
    total_anomalies_detected: int
    anomalies: List[AnomalyDetail]


class TrainModelResponse(BaseModel):
    machine_id: str
    status: str
    message: str
    metrics: dict
