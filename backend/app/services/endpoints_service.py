from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional

class EndpointsService:
    def __init__(self, db: Session):
        self.db = db
    
    async def get_endpoints(
        self, 
        endpoint_type: Optional[str] = None, 
        bounds: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get endpoints within specified bounds and/or filtered by type."""
        base_query = """
            SELECT 
                endpoint_id,
                endpoint_type,
                intake_id,
                ST_AsGeoJSON(geom) as geometry
            FROM endpoints
            WHERE 1=1
        """
        params = {}
        
        if endpoint_type:
            base_query += " AND endpoint_type = :endpoint_type"
            params["endpoint_type"] = endpoint_type
        
        if bounds:
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, bounds.split(','))
                base_query += """
                    AND ST_Intersects(
                        geom,
                        ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326)
                    )
                """
                params.update({
                    "min_lon": min_lon,
                    "min_lat": min_lat,
                    "max_lon": max_lon,
                    "max_lat": max_lat
                })
            except (ValueError, IndexError):
                raise ValueError("Invalid bounds format. Use: 'minLon,minLat,maxLon,maxLat'")
        
        base_query += " ORDER BY endpoint_type, endpoint_id"
        
        results = self.db.execute(text(base_query), params).fetchall()
        return [dict(row) for row in results]
    
    async def get_endpoint_types(self) -> List[str]:
        """Get all available endpoint types."""
        query = text("""
            SELECT DISTINCT endpoint_type
            FROM endpoints
            ORDER BY endpoint_type
        """)
        
        results = self.db.execute(query).fetchall()
        return [row.endpoint_type for row in results]
