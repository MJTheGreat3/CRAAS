from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..services.contamination_analysis import ContaminationAnalysisService
from ..schemas.contamination import ContaminationInput, ContaminationAnalysisResponse, RiskResult

router = APIRouter()

@router.post("/analyze", response_model=ContaminationAnalysisResponse)
async def analyze_contamination(
    input_data: ContaminationInput,
    db: Session = Depends(get_db)
):
    """
    Analyze contamination spread from a given point.
    
    - **lat**: Latitude of contamination point
    - **lon**: Longitude of contamination point  
    - **dispersion_rate_kmph**: Contaminant spread speed in km/h
    - **time_window_hours**: Time horizon for analysis in hours
    - **contaminant_type**: Optional contaminant type/name
    """
    try:
        service = ContaminationAnalysisService(db)
        result = await service.analyze_contamination(input_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_contamination_history(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get historical contamination analysis results."""
    try:
        service = ContaminationAnalysisService(db)
        return await service.get_history(limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{contamination_id}")
async def get_contamination_detail(
    contamination_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed results for a specific contamination analysis."""
    try:
        service = ContaminationAnalysisService(db)
        result = await service.get_contamination_detail(contamination_id)
        if not result:
            raise HTTPException(status_code=404, detail="Contamination analysis not found")
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
