from pydantic import BaseModel
from typing import List, Optional

class ContaminationInput(BaseModel):
    lat: float
    lon: float
    dispersion_rate: float  # Dispersion rate as decimal (e.g., 0.05 for 5% per km)
    contaminant_type: str = "chemical"  # Default to chemical, not optional
    analysis_radius: float = 10.0  # Analysis radius in kilometers (default 10km)
    # Customizable risk thresholds (percentage concentrations)
    high_threshold: float = 10.0  # Default 10% for high risk
    moderate_threshold: float = 5.0  # Default 5% for moderate risk  
    low_threshold: float = 1.0  # Default 1% for low risk (below this is safe)

class RiskResult(BaseModel):
    endpoint_id: int
    endpoint_type: str
    endpoint_name: Optional[str] = None
    arrival_hours: float
    distance_km: float
    risk_level: str
    concentration: Optional[float] = None  # Concentration at endpoint

class ContaminationAnalysisResponse(BaseModel):
    contamination_id: int
    results: List[RiskResult]
    total_at_risk: int
    analysis_time_seconds: float