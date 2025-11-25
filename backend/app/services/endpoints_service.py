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
                fid as endpoint_id,
                CASE
                    WHEN object_class = 'school' THEN 'school'
                    WHEN object_class = 'hospital' THEN 'hospital'
                    WHEN object_class = 'residential' THEN 'residential'
                    WHEN object_class = 'industrial' THEN 'industrial'
                    WHEN object_class = 'farmland' THEN 'farmland'
                    WHEN amenity = 'school' THEN 'school'
                    WHEN building = 'school' THEN 'school'
                    WHEN amenity = 'hospital' THEN 'hospital'
                    WHEN healthcare = 'hospital' THEN 'hospital'
                    WHEN amenity = 'clinic' THEN 'clinic'
                    WHEN healthcare = 'clinic' THEN 'clinic'
                    ELSE 'other'
                END as endpoint_type,
                NULL as intake_id,
                ST_AsGeoJSON(geom) as geometry,
                name,
                amenity,
                building,
                healthcare,
                object_class
            FROM endpoints
            WHERE geom IS NOT NULL
        """
        params = {}

        if endpoint_type:
            if endpoint_type == 'school':
                base_query += " AND (amenity = 'school' OR building = 'school')"
            elif endpoint_type == 'hospital':
                base_query += " AND amenity = 'hospital'"
            elif endpoint_type == 'clinic':
                base_query += " AND amenity = 'clinic'"
            else:
                base_query += " AND (amenity = :endpoint_type OR building = :endpoint_type)"
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

        base_query += " ORDER BY endpoint_type, fid"

        results = self.db.execute(text(base_query), params).fetchall()
        return [row._asdict() for row in results]
    
    async def get_endpoint_types(self) -> List[str]:
        """Get all available endpoint types."""
        query = text("""
            SELECT DISTINCT
                CASE
                    WHEN object_class = 'school' THEN 'school'
                    WHEN object_class = 'hospital' THEN 'hospital'
                    WHEN object_class = 'residential' THEN 'residential'
                    WHEN object_class = 'industrial' THEN 'industrial'
                    WHEN object_class = 'farmland' THEN 'farmland'
                    WHEN amenity = 'school' THEN 'school'
                    WHEN building = 'school' THEN 'school'
                    WHEN amenity = 'hospital' THEN 'hospital'
                    WHEN healthcare = 'hospital' THEN 'hospital'
                    WHEN amenity = 'clinic' THEN 'clinic'
                    WHEN healthcare = 'clinic' THEN 'clinic'
                    ELSE 'other'
                END as endpoint_type
            FROM endpoints
            WHERE object_class IS NOT NULL OR amenity IS NOT NULL OR building IS NOT NULL OR healthcare IS NOT NULL
            ORDER BY endpoint_type
        """)

        results = self.db.execute(query).fetchall()
        return [row.endpoint_type for row in results]
