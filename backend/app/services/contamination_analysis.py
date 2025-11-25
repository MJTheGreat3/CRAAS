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
        
        # Step 2: Find endpoints connected via outlets and pipelines
        # Calculate realistic distances: waterway distance (estimated) + pipeline distance
        # Use elevation to ensure downstream flow only
        endpoints_query = text("""
            WITH contamination_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) as geom
            ),
            -- Get contamination point elevation
            contamination_elevation AS (
                SELECT 
                    cp.geom,
                    COALESCE(
                        (SELECT elevation FROM waterways_vertices_pgr v 
                         ORDER BY v.geom <-> cp.geom LIMIT 1),
                        0
                    ) as contamination_elev
                FROM contamination_point cp
            ),
            -- Connect endpoints to their outlets via OSM ID, check downstream flow
            endpoint_outlet_connections AS (
                SELECT
                    e.fid as endpoint_id,
                    e.name as endpoint_name,
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
                    o.geom as outlet_geom,
                    o.name as outlet_name,
                    o.elevation as outlet_elevation,
                    -- Pipeline distance: use pipeline length if available, otherwise straight-line
                    COALESCE(
                        (SELECT ST_Length(p.geom::geography) FROM pipelines p WHERE p.osm_id = e.osm_id LIMIT 1),
                        ST_Distance(e.geom::geography, o.geom::geography)
                    ) as pipeline_distance_m,
                    -- Waterway distance: estimated as distance from contamination to outlet
                    ST_Distance(cp.geom::geography, o.geom::geography) as waterway_distance_m
                FROM endpoints e
                INNER JOIN outlets o ON e.osm_id = o.osm_id  -- Connect via OSM ID
                CROSS JOIN contamination_point cp
                CROSS JOIN contamination_elevation ce
                WHERE e.geom IS NOT NULL AND o.geom IS NOT NULL
                AND (
                    e.object_class IN ('school', 'hospital', 'residential', 'industrial', 'farmland') OR
                    e.amenity IN ('school', 'hospital', 'clinic') OR
                    e.healthcare IS NOT NULL
                )  -- Focus on meaningful endpoints
                AND COALESCE(o.elevation::double precision, 0) <= ce.contamination_elev  -- Only downstream flow
            )
            SELECT
                endpoint_id,
                endpoint_name,
                endpoint_type,
                endpoint_geom,
                outlet_name,
                waterway_distance_m / 1000.0 as waterway_distance_km,
                pipeline_distance_m / 1000.0 as pipeline_distance_km,
                (waterway_distance_m + pipeline_distance_m) / 1000.0 as total_distance_km
            FROM endpoint_outlet_connections
            WHERE waterway_distance_m > 0  -- Must be some distance
            AND (waterway_distance_m + pipeline_distance_m) / 1000.0 <= :analysis_radius  -- Limit by analysis radius
            ORDER BY total_distance_km
            LIMIT 1000  -- Much larger limit to find distant endpoints
        """)

        endpoints_results = self.db.execute(endpoints_query, {
            "lon": input_data.lon,
            "lat": input_data.lat,
            "analysis_radius": input_data.analysis_radius
        }).fetchall()
        
        # Step 3: Process results and determine risk levels based on distance
        risk_results = []

        # Use custom thresholds provided by user, with fallback to defaults
        thresholds = {
            'high': input_data.high_threshold,
            'moderate': input_data.moderate_threshold, 
            'low': input_data.low_threshold
        }
        
        # Process endpoints with concentration-based risk calculation
        for row in endpoints_results:
            total_distance_km = float(row.total_distance_km)
            
            # Calculate concentration at distance using exponential decay
            # C(d) = C0 * (1 - dispersion_rate)^d
            # Where C0 = 100% (initial concentration), d = distance in km
            concentration_at_distance = 100.0 * ((1.0 - input_data.dispersion_rate) ** total_distance_km)
            
            # Determine risk level based on concentration
            risk_level = self._determine_risk_by_concentration(concentration_at_distance, thresholds)
            
            # Only include endpoints with measurable risk
            if risk_level and risk_level != "Safe":
                risk_results.append(RiskResult(
                    endpoint_id=int(row.endpoint_id),
                    endpoint_type=row.endpoint_type,
                    arrival_hours=0,  # Legacy field - not used in concentration model
                    distance_km=total_distance_km,
                    risk_level=risk_level,
                    endpoint_name=row.endpoint_name or f"{row.endpoint_type.title()} {row.endpoint_id}",
                    concentration=concentration_at_distance  # Add concentration data
                ))
        
        # Sort by concentration (highest risk first), then by distance
        risk_results.sort(key=lambda x: (-x.concentration or 0, x.distance_km))
        
        # Step 5: Save contamination event to history
        contamination_event = ContaminationEvent(
            contamination_point=f"SRID=4326;POINT({input_data.lon} {input_data.lat})",
            contaminant_type=input_data.contaminant_type,
            severity_level="medium",  # Default since not used in new model
            description=None,  # Not used in new model
            analysis_results={
                "total_at_risk": len(risk_results),
                "water_intakes_at_risk": len([r for r in risk_results if r.endpoint_type == "water_intake"]),
                "schools_at_risk": len([r for r in risk_results if r.endpoint_type == "school"]),
                "parameters": {
                    "lat": input_data.lat,
                    "lon": input_data.lon,
                    "dispersion_rate": input_data.dispersion_rate,
                    "contaminant_type": input_data.contaminant_type
                }
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
    
    def _determine_risk_by_concentration(self, concentration: float, thresholds: dict) -> str:
        """Determine risk level based on contaminant concentration."""
        if concentration >= thresholds['high']:
            return "High"
        elif concentration >= thresholds['moderate']:
            return "Moderate"
        elif concentration >= thresholds['low']:
            return "Low"
        else:
            return "Safe"  # Below safe threshold
    
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
