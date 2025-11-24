from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any
from datetime import datetime
import time
from ..models.contamination import ContaminationEvent
from ..schemas.contamination import ContaminationInput, ContaminationAnalysisResponse, RiskResult

class ContaminationAnalysisService:
    def __init__(self, db: Session):
        self.db = db
    
    async def analyze_contamination(self, input_data: ContaminationInput) -> ContaminationAnalysisResponse:
        """Perform contamination spread analysis using pgRouting."""
        start_time = time.time()
        
        # Step 1: Snap contamination point to nearest hydrology line
        snap_query = text("""
            SELECT 
                hl.id as line_id,
                ST_ClosestPoint(hl.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as snapped_point,
                ST_Distance(hl.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as distance_m
            FROM hydro_lines hl
            ORDER BY hl.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
            LIMIT 1
        """)
        
        snap_result = self.db.execute(snap_query, {
            "lat": input_data.lat,
            "lon": input_data.lon
        }).fetchone()
        
        if not snap_result:
            raise ValueError("No hydrology network found near the specified point")
        
        # Step 2: Find all reachable endpoints within time window using pgRouting
        analysis_query = text("""
            WITH contamination_source AS (
                SELECT ST_ClosestPoint(hl.geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)) as geom
                FROM hydro_lines hl
                ORDER BY hl.geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
                LIMIT 1
            ),
            network_analysis AS (
                SELECT 
                    e.endpoint_id,
                    e.endpoint_type,
                    e.geom as endpoint_geom,
                    pgr_dijkstra(
                        'SELECT id, source, target, length_m as cost FROM hydro_lines',
                        (SELECT source FROM hydro_lines ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) LIMIT 1),
                        (SELECT source FROM hydro_lines hl2, endpoints e 
                         WHERE e.endpoint_id = hl2.id AND e.endpoint_id = :endpoint_id LIMIT 1)
                    ) as path
                FROM endpoints e, contamination_source cs
                WHERE e.endpoint_type IN ('hospital', 'school', 'farmland', 'residential')
            )
            SELECT 
                endpoint_id,
                endpoint_type,
                SUM(cost) / 1000.0 / :dispersion_rate as arrival_hours,
                SUM(cost) / 1000.0 as distance_km
            FROM network_analysis, pgr_dijkstra(
                'SELECT id, source, target, length_m as cost FROM hydro_lines',
                (SELECT source FROM hydro_lines ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) LIMIT 1),
                target
            ) as dijkstra
            WHERE SUM(cost) / 1000.0 / :dispersion_rate <= :time_window
            GROUP BY endpoint_id, endpoint_type
            ORDER BY arrival_hours
        """)
        
        # Simplified version for now - we'll refine this based on actual database structure
        results_query = text("""
            SELECT 
                e.endpoint_id,
                e.endpoint_type,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                    e.geom
                ) / 1000.0 / :dispersion_rate as arrival_hours,
                ST_Distance(
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                    e.geom
                ) / 1000.0 as distance_km
            FROM endpoints e
            WHERE ST_Distance(
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326),
                e.geom
            ) / 1000.0 / :dispersion_rate <= :time_window
            ORDER BY arrival_hours
        """)
        
        results = self.db.execute(results_query, {
            "lat": input_data.lat,
            "lon": input_data.lon,
            "dispersion_rate": input_data.dispersion_rate_kmph,
            "time_window": input_data.time_window_hours
        }).fetchall()
        
        # Step 3: Process results and determine risk levels
        risk_results = []
        for row in results:
            arrival_hours = float(row.arrival_hours)
            risk_level = self._determine_risk_level(arrival_hours)
            
            risk_results.append(RiskResult(
                endpoint_id=row.endpoint_id,
                endpoint_type=row.endpoint_type,
                arrival_hours=arrival_hours,
                distance_km=float(row.distance_km),
                risk_level=risk_level
            ))
        
        # Step 4: Save contamination event to history
        contamination_event = ContaminationEvent(
            timestamp=datetime.utcnow(),
            params_json=input_data.dict(),
            geom=f"POINT({input_data.lon} {input_data.lat})"
        )
        self.db.add(contamination_event)
        self.db.commit()
        self.db.refresh(contamination_event)
        
        analysis_time = time.time() - start_time
        
        return ContaminationAnalysisResponse(
            contamination_id=contamination_event.id,
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
                timestamp,
                params_json,
                ST_X(geom) as lon,
                ST_Y(geom) as lat
            FROM contamination_history
            ORDER BY timestamp DESC
            LIMIT :limit
        """)
        
        results = self.db.execute(query, {"limit": limit}).fetchall()
        return [dict(row) for row in results]
    
    async def get_contamination_detail(self, contamination_id: int) -> Dict[str, Any]:
        """Get detailed results for a specific contamination analysis."""
        query = text("""
            SELECT 
                id,
                timestamp,
                params_json,
                ST_X(geom) as lon,
                ST_Y(geom) as lat
            FROM contamination_history
            WHERE id = :contamination_id
        """)
        
        result = self.db.execute(query, {"contamination_id": contamination_id}).fetchone()
        return dict(result) if result else None
