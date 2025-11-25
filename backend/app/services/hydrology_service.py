from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any, Optional

class HydrologyService:
    def __init__(self, db: Session):
        self.db = db
    
    async def get_network(self, bounds: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get hydrology network data within specified bounds."""
        if bounds:
            # Parse bounds: "minLon,minLat,maxLon,maxLat"
            try:
                min_lon, min_lat, max_lon, max_lat = map(float, bounds.split(','))
                query = text("""
                    SELECT
                        id,
                        source,
                        target,
                        length_m,
                        ST_AsGeoJSON(geom_ls) as geometry
                    FROM waterways
                    WHERE ST_Intersects(
                        geom_ls,
                        ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326)
                    )
                """)
                results = self.db.execute(query, {
                    "min_lon": min_lon,
                    "min_lat": min_lat,
                    "max_lon": max_lon,
                    "max_lat": max_lat
                }).fetchall()
            except (ValueError, IndexError):
                raise ValueError("Invalid bounds format. Use: 'minLon,minLat,maxLon,maxLat'")
        else:
            # Get all network data (limit for performance)
            query = text("""
                SELECT
                    id,
                    source,
                    target,
                    length_m,
                    ST_AsGeoJSON(geom_ls) as geometry
                FROM waterways
                LIMIT 10000
            """)
            results = self.db.execute(query).fetchall()

        return [row._asdict() for row in results]
    
    async def snap_point_to_network(self, lat: float, lon: float) -> Dict[str, Any]:
        """Snap a point to the nearest hydrology network line."""
        query = text("""
            SELECT
                id as line_id,
                ST_AsGeoJSON(ST_ClosestPoint(geom_ls, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))) as snapped_point,
                ST_Distance(geom_ls::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) as distance_m,
                ST_AsGeoJSON(geom_ls) as line_geometry
            FROM waterways
            ORDER BY geom_ls <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT 1
        """)

        result = self.db.execute(query, {"lat": lat, "lon": lon}).fetchone()

        if not result:
            raise ValueError("No hydrology network found near the specified point")

        return dict(result)
