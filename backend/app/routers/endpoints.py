from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..services.endpoints_service import EndpointsService

router = APIRouter()

@router.get("/")
async def get_endpoints(
    endpoint_type: Optional[str] = None,
    bounds: str = None,  # "minLon,minLat,maxLon,maxLat"
    db: Session = Depends(get_db)
):
    """Get endpoints (hospitals, schools, farmlands, etc.) within bounds."""
    try:
        service = EndpointsService(db)
        return await service.get_endpoints(endpoint_type, bounds)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/types")
async def get_endpoint_types(db: Session = Depends(get_db)):
    """Get all available endpoint types."""
    try:
        service = EndpointsService(db)
        return await service.get_endpoint_types()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
