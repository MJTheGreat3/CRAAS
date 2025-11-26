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
        
        # Step 1: Snap contamination point to nearest waterway and find flow source vertex
        snap_query = text("""
            WITH contamination_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) as geom
            ),
            nearest_waterway AS (
                SELECT
                    w.id,
                    w.source,
                    w.target,
                    ST_ClosestPoint(w.geom_ls, cp.geom) as snapped_point,
                    ST_Distance(w.geom_ls, cp.geom) as snap_distance_m,
                    v1.elev as source_elev,
                    v2.elev as target_elev,
                    CASE 
                        WHEN v1.elev > v2.elev THEN w.source  -- Flow from source to target
                        WHEN v2.elev > v1.elev THEN w.target  -- Flow from target to source (reverse)
                        ELSE w.source  -- Default to source for flat terrain
                    END as flow_source_vertex
                FROM waterways w
                CROSS JOIN contamination_point cp
                LEFT JOIN waterways_vertices_pgr v1 ON w.source = v1.id
                LEFT JOIN waterways_vertices_pgr v2 ON w.target = v2.id
                ORDER BY w.geom_ls <-> cp.geom
                LIMIT 1
            ),
            flow_source_vertex_info AS (
                SELECT
                    v.id as vertex_id,
                    v.geom
                FROM waterways_vertices_pgr v
                CROSS JOIN nearest_waterway nw
                WHERE v.id = nw.flow_source_vertex
            )
            SELECT
                nw.id as waterway_id,
                nw.snapped_point,
                nw.snap_distance_m,
                nw.flow_source_vertex as vertex_id,
                fv.geom as vertex_geom,
                nw.source_elev,
                nw.target_elev,
                CASE 
                    WHEN nw.source_elev > nw.target_elev THEN 'DOWNSTREAM (source→target)'
                    WHEN nw.target_elev > nw.source_elev THEN 'DOWNSTREAM (target→source)'
                    ELSE 'FLAT'
                END as flow_direction
            FROM nearest_waterway nw
            CROSS JOIN flow_source_vertex_info fv
        """)
        
        snap_result = self.db.execute(snap_query, {
            "lat": input_data.lat,
            "lon": input_data.lon
        }).fetchone()
        
        if not snap_result:
            raise ValueError("No waterway network found near the specified point")
        
        source_vertex = snap_result.vertex_id
        
        # Step 2: True downstream analysis using pgRouting flow routing
        # This finds endpoints reachable via actual downstream waterway flow paths
        downstream_query = text("""
            WITH contamination_point AS (
                SELECT ST_SetSRID(ST_MakePoint(:lon, :lat), 4326) as geom
            ),
            -- Find nearest waterway segment and determine flow direction
            nearest_waterway AS (
                SELECT
                    w.id,
                    w.source,
                    w.target,
                    ST_ClosestPoint(w.geom_ls, cp.geom) as snapped_point,
                    ST_Distance(w.geom_ls, cp.geom) as snap_distance_m,
                    v1.elev as source_elev,
                    v2.elev as target_elev,
                    CASE 
                        WHEN v1.elev > v2.elev THEN w.source  -- Flow from source to target
                        WHEN v2.elev > v1.elev THEN w.target  -- Flow from target to source (reverse)
                        ELSE w.source  -- Default to source for flat terrain
                    END as flow_source_vertex
                FROM waterways w
                CROSS JOIN contamination_point cp
                LEFT JOIN waterways_vertices_pgr v1 ON w.source = v1.id
                LEFT JOIN waterways_vertices_pgr v2 ON w.target = v2.id
                ORDER BY w.geom_ls <-> cp.geom
                LIMIT 1
            ),
            -- True downstream flow analysis using pgr_drivingDistance
            -- This finds all vertices reachable following STRICTLY downstream water flow
            downstream_reachable AS (
                SELECT 
                    dr.node as vertex_id,
                    dr.agg_cost as flow_distance_km,
                    v.elev as vertex_elevation
                FROM pgr_drivingDistance(
                    'SELECT id, source, target, 
                     CASE 
                        WHEN source_elev > target_elev AND (target_elev - source_elev) >= -50 THEN 0.1  -- Allow only downhill flow within reasonable elevation change
                        ELSE 1000.0                                  -- Completely block flat or uphill flow
                     END as cost,
                     1000.0 as reverse_cost  -- Completely block reverse flow
                     FROM (
                         SELECT w.id, w.source, w.target,
                                COALESCE(v1.elev, 0) as source_elev, 
                                COALESCE(v2.elev, 0) as target_elev
                         FROM waterways w
                         LEFT JOIN waterways_vertices_pgr v1 ON w.source = v1.id
                         LEFT JOIN waterways_vertices_pgr v2 ON w.target = v2.id
                         WHERE COALESCE(v1.elev, 0) > 0 AND COALESCE(v2.elev, 0) > 0  -- Only use segments with valid elevation data
                     ) w_elev',
                    (SELECT flow_source_vertex FROM nearest_waterway),
                    :analysis_radius * 10,  -- Increase radius to account for higher costs
                    directed := true
                ) dr
                JOIN waterways_vertices_pgr v ON dr.node = v.id
                WHERE dr.agg_cost > 0  -- Exclude the source vertex itself
                AND dr.agg_cost <= :analysis_radius * 2  -- Filter by actual distance, not accumulated cost
                AND v.elev <= (SELECT GREATEST(source_elev, target_elev) FROM nearest_waterway)  -- Only include vertices at or below source elevation
            ),
            -- Find outlets near downstream reachable vertices
            downstream_outlets AS (
                SELECT DISTINCT
                    o.osm_id,
                    MIN(dr.flow_distance_km + ST_Distance(o.geom::geography, v.geom::geography) / 1000.0) as total_distance_km
                FROM outlets o
                JOIN downstream_reachable dr ON ST_DWithin(o.geom, (
                    SELECT geom FROM waterways_vertices_pgr WHERE id = dr.vertex_id
                ), 1000)
                JOIN waterways_vertices_pgr v ON dr.vertex_id = v.id
                WHERE dr.flow_distance_km > 0  -- Ensure actual downstream flow
                GROUP BY o.osm_id
            )
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
                COALESCE(downstream_outlets.total_distance_km, 0) as waterway_distance_km,
                0.5 as pipeline_distance_km,
                CASE WHEN downstream_outlets.total_distance_km IS NOT NULL THEN 1 ELSE 0 END as waterway_hops
            FROM endpoints e
            INNER JOIN outlets o ON e.osm_id = o.osm_id
            INNER JOIN downstream_outlets ON o.osm_id = downstream_outlets.osm_id
            WHERE e.geom IS NOT NULL 
            AND downstream_outlets.total_distance_km IS NOT NULL
            AND (
                e.object_class IN ('school', 'hospital', 'residential', 'industrial', 'farmland') OR
                e.amenity IN ('school', 'hospital', 'clinic') OR
                e.healthcare IS NOT NULL
            )
            ORDER BY downstream_outlets.total_distance_km
            LIMIT 500
        """)

        downstream_results = self.db.execute(downstream_query, {
            "lon": input_data.lon,
            "lat": input_data.lat,
            "analysis_radius": input_data.analysis_radius
        }).fetchall()
        
        # Step 4: Process results and determine risk levels based on distance
        risk_results = []

        # Use custom thresholds provided by user
        thresholds = {
            'high': input_data.high_threshold,
            'moderate': input_data.moderate_threshold, 
            'low': input_data.low_threshold
        }
        
        # Process endpoints with concentration-based risk calculation
        for row in downstream_results:
            total_distance_km = float(float(row.waterway_distance_km) + float(row.pipeline_distance_km))
            
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
                    concentration=concentration_at_distance,  # Add concentration data
                    waterway_hops=getattr(row, 'waterway_hops', 0)  # Add downstream flow info
                ))
        
        # Sort by concentration (highest risk first), then by distance
        risk_results.sort(key=lambda x: (-x.concentration or 0, x.distance_km))
        
        # Step 5: Save contamination event to history
        contamination_event = ContaminationEvent(
            contamination_point=f"SRID=4326;POINT({input_data.lon} {input_data.lat})",
            contaminant_type="chemical",  # Hardcoded since removed from input
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
                    "analysis_radius": input_data.analysis_radius
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
