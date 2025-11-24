from pydantic import BaseModel
from typing import List, Optional

class ContaminationInput(BaseModel):
    lat: float
    lon: float
    dispersion_rate_kmph: float
    time_window_hours: int
    contaminant_type: Optional[str] = "chemical"
    severity_level: Optional[str] = "medium"
    description: Optional[str] = None

class RiskResult(BaseModel):
    endpoint_id: int
    endpoint_type: str
    endpoint_name: Optional[str] = None
    arrival_hours: float
    distance_km: float
    risk_level: str

class ContaminationAnalysisResponse(BaseModel):
    contamination_id: int
    results: List[RiskResult]
    total_at_risk: int
    analysis_time_seconds: float