from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from datetime import datetime
import time
from app.models.contamination import ContaminationEvent
from app.schemas.contamination import ContaminationInput, ContaminationAnalysisResponse, RiskResult

class ContaminationAnalysisService:
    def __init__(self, db: Session):
        self.db = db
    
    async def analyze_contamination(self, input_data: ContaminationInput) -> ContaminationAnalysisResponse:
        """Perform contamination spread analysis using pgRouting."""
        start_time = time.time()
        
        # Step 1: Snap contamination point to nearest waterway and find nearest vertex
        snap_query = text("""
            WITH contamination_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) as geom
            ),
            nearest_waterway AS (
                SELECT
                    w.id,
                    ST_ClosestPoint(w.geom_ls, cp.geom) as snapped_point,
                    ST_Distance(w.geom_ls, cp.geom) as snap_distance_m
                FROM waterways w, contamination_point cp
                ORDER BY w.geom_ls <-> cp.geom
                LIMIT 1
            ),
            nearest_vertex AS (
                SELECT
                    v.id as vertex_id,
                    v.geom
                FROM waterways_vertices_pgr v, nearest_waterway nw
                ORDER BY v.geom <-> nw.snapped_point
                LIMIT 1
            )
            SELECT
                nw.id as waterway_id,
                nw.snapped_point,
                nw.snap_distance_m,
                nv.vertex_id,
                nv.geom as vertex_geom
            FROM nearest_waterway nw, nearest_vertex nv
        """)
        
        snap_result = self.db.execute(snap_query, {
            "lat": input_data.lat,
            "lon": input_data.lon
        }).fetchone()
        
        if not snap_result:
            raise ValueError("No waterway network found near the specified point")
        
        source_vertex = snap_result.vertex_id
        
        # Step 2: Find endpoints near the contamination source using straight-line distance
        # This is a simplified approach for initial functionality - can be enhanced with network routing later
        endpoints_query = text("""
            WITH contamination_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) as geom
            )
            SELECT
                e.fid as endpoint_id,
                e.name,
                CASE
                    WHEN e.object_class = 'school' THEN 'school'
                    WHEN e.object_class = 'hospital' THEN 'hospital'
                    WHEN e.object_class = 'residential' THEN 'residential'
                    WHEN e.object_class = 'industrial' THEN 'industrial'
                    WHEN e.object_class = 'farmland' THEN 'farmland'
                    WHEN e.amenity = 'school' THEN 'school'
                    WHEN e.building = 'school' THEN 'school'
                    WHEN e.amenity = 'hospital' THEN 'hospital'
                    WHEN e.healthcare = 'hospital' THEN 'hospital'
                    WHEN e.amenity = 'clinic' THEN 'clinic'
                    WHEN e.healthcare = 'clinic' THEN 'clinic'
                    ELSE 'other'
                END as endpoint_type,
                e.geom as endpoint_geom,
                ST_Distance(e.geom::geography, cp.geom::geography) as distance_m,
                ST_Distance(e.geom::geography, cp.geom::geography) / 1000.0 as distance_km,
                (ST_Distance(e.geom::geography, cp.geom::geography) / 1000.0) / :dispersion_rate as arrival_hours
            FROM endpoints e, contamination_point cp
            WHERE e.geom IS NOT NULL
            AND (ST_Distance(e.geom::geography, cp.geom::geography) / 1000.0) / :dispersion_rate <= :time_window
            ORDER BY ST_Distance(e.geom::geography, cp.geom::geography)
            LIMIT 50  -- Limit results for performance
        """)

        endpoints_results = self.db.execute(endpoints_query, {
            "lon": input_data.lon,
            "lat": input_data.lat,
            "dispersion_rate": input_data.dispersion_rate_kmph,
            "time_window": input_data.time_window_hours
        }).fetchall()
        
        # Step 3: Process results and determine risk levels
        risk_results = []

        # Process endpoints
        for row in endpoints_results:
            arrival_hours = float(row.arrival_hours)
            risk_level = self._determine_risk_level(arrival_hours)

            risk_results.append(RiskResult(
                endpoint_id=int(row.endpoint_id),
                endpoint_type=row.endpoint_type,
                arrival_hours=arrival_hours,
                distance_km=float(row.distance_km),
                risk_level=risk_level,
                endpoint_name=row.name or f"{row.endpoint_type.title()} {row.endpoint_id}"
            ))
        
        # Sort by arrival time
        risk_results.sort(key=lambda x: x.arrival_hours)
        
        # Step 5: Save contamination event to history
        contamination_event = ContaminationEvent(
            contamination_point=f"SRID=4326;POINT({input_data.lon} {input_data.lat})",
            contaminant_type=input_data.contaminant_type,
            severity_level=input_data.severity_level,
            description=input_data.description,
            analysis_results={
                "total_at_risk": len(risk_results),
                "water_intakes_at_risk": len([r for r in risk_results if r.endpoint_type == "water_intake"]),
                "schools_at_risk": len([r for r in risk_results if r.endpoint_type == "school"]),
                "parameters": input_data.dict()
            }
        )
        self.db.add(contamination_event)
        self.db.commit()
        self.db.refresh(contamination_event)
        
        analysis_time = time.time() - start_time
        
        return ContaminationAnalysisResponse(
            contamination_id=1,  # Temporary ID for now
            results=risk_results,
            total_at_risk=len(risk_results),
            analysis_time_seconds=analysis_time
        )
    
    def _determine_risk_level(self, arrival_hours: float) -> str:
        """Determine risk level based on arrival time."""
        if arrival_hours < 6:
            return "High"
        elif arrival_hours <= 24:
            return "Moderate"
        else:
            return "Low"
    
    async def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get historical contamination analysis results."""
        query = text("""
            SELECT 
                id,
                contamination_time,
                contaminant_type,
                severity_level,
                description,
                analysis_results,
                ST_X(contamination_point) as lon,
                ST_Y(contamination_point) as lat
            FROM contamination_history
            ORDER BY contamination_time DESC
            LIMIT :limit
        """)
        
        results = self.db.execute(query, {"limit": limit}).fetchall()
        return [dict(row) for row in results]
    
    async def get_contamination_detail(self, contamination_id: int) -> Dict[str, Any]:
        """Get detailed results for a specific contamination analysis."""
        query = text("""
            SELECT 
                id,
                contamination_time,
                contaminant_type,
                severity_level,
                description,
                analysis_results,
                ST_X(contamination_point) as lon,
                ST_Y(contamination_point) as lat
            FROM contamination_history
            WHERE id = :contamination_id
        """)
        
        result = self.db.execute(query, {"contamination_id": contamination_id}).fetchone()
        if result:
            return dict(result)
        else:
            return {"error": "Contamination analysis not found"}
