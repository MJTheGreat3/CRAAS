from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..services.hydrology_service import HydrologyService

router = APIRouter()

@router.get("/network")
async def get_hydrology_network(
    bounds: str = None,  # "minLon,minLat,maxLon,maxLat"
    db: Session = Depends(get_db)
):
    """Get hydrology network data within specified bounds."""
    try:
        service = HydrologyService(db)
        return await service.get_network(bounds)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/snap-to-network")
async def snap_to_network(
    lat: float,
    lon: float,
    db: Session = Depends(get_db)
):
    """Snap a point to the nearest hydrology network line."""
    try:
        service = HydrologyService(db)
        result = await service.snap_point_to_network(lat, lon)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
