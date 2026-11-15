"""
FastAPI Route Handlers for MARSWALK Planetary Planning Services.
"""
import os
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
import numpy as np

from backend.api.schemas import (
    DatasetMetadata,
    LayerDefinition,
    CoverageResponse,
    PointTerrainRequest,
    PointTerrainResponse,
    TerrainMesh3DResponse,
    ScienceTargetResponse,
    EnvironmentRequest,
    RoutePlanRequest,
    RoutePlanResponse,
    RouteCompareRequest,
    RouteCompareResponse,
    MissionSimulateRequest,
    MissionSimulateResponse,
    ReportGenerateRequest,
    MobilityRequest,
    MobilityResponse,
    RestScheduleSchema,
    ReturnabilityRequest,
    ReturnabilityResponse,
    ReturnCheckpointSchema,
    EmergencyEventRequest,
    EmergencyEventResponse,
    ConfidenceRequest,
    ConfidenceResponse,
    MonteCarloRequest,
    MonteCarloResponse,
    SensitivityResponse,
    DiscoveredTargetSchema,
    ScienceTourRequest,
    ScienceTourResponse,
    TourStopSchema,
    HabitatCandidateSchema
)
from backend.core.terrain import TerrainModel
from backend.core.router import MartianAStarRouter, RouteResult
from backend.core.science import ScienceCatalog
from backend.core.environment import EnvironmentalModel
from backend.core.simulator import MissionSimulator, SpacesuitConfig, SimulationResult
from backend.core.reporter import ExpeditionReporter
from backend.core.nasa_client import NasaApiClient
from backend.core.mobility import MobilityEstimator
from backend.core.returnability import ReturnabilityEngine
from backend.core.confidence import MissionConfidenceEngine
from backend.core.discovery import ScienceDiscoveryEngine
from backend.core.habitat import HabitatSelectionEngine

api_router = APIRouter(prefix="/api/v1")

# Global singleton components loaded on startup
DTM_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif")
_terrain_model: Optional[TerrainModel] = None
_router_20m: Optional[MartianAStarRouter] = None
_router_40m: Optional[MartianAStarRouter] = None
_science_catalog = ScienceCatalog()
_environmental_model = EnvironmentalModel()
_nasa_client = NasaApiClient()
_returnability_engine: Optional[ReturnabilityEngine] = None
_confidence_engine: Optional[MissionConfidenceEngine] = None
_habitat_engine: Optional[HabitatSelectionEngine] = None
_discovery_engine: Optional[ScienceDiscoveryEngine] = None
_mobility_estimator = MobilityEstimator()

def get_returnability_engine() -> ReturnabilityEngine:
    global _returnability_engine
    if _returnability_engine is None:
        _returnability_engine = ReturnabilityEngine(get_terrain(), get_router(2))
    return _returnability_engine

def get_confidence_engine() -> MissionConfidenceEngine:
    global _confidence_engine
    if _confidence_engine is None:
        _confidence_engine = MissionConfidenceEngine(get_terrain())
    return _confidence_engine

def get_discovery_engine() -> ScienceDiscoveryEngine:
    global _discovery_engine
    if _discovery_engine is None:
        _discovery_engine = ScienceDiscoveryEngine(_science_catalog)
    return _discovery_engine

def get_habitat_engine() -> HabitatSelectionEngine:
    global _habitat_engine
    if _habitat_engine is None:
        _habitat_engine = HabitatSelectionEngine(get_terrain(), _science_catalog)
    return _habitat_engine

def get_terrain() -> TerrainModel:
    global _terrain_model
    if _terrain_model is None:
        if not os.path.exists(DTM_PATH):
            raise RuntimeError(f"USGS CTX DTM file not found at {DTM_PATH}")
        _terrain_model = TerrainModel.from_geotiff(DTM_PATH)
    return _terrain_model

def get_router(downsample_factor: int = 2) -> MartianAStarRouter:
    """Returns A* router. Downsample factor 2 gives 40m grid for rapid sub-second query response."""
    global _router_20m, _router_40m
    terrain = get_terrain()
    if downsample_factor == 1:
        if _router_20m is None:
            _router_20m = MartianAStarRouter(terrain)
        return _router_20m
    else:
        if _router_40m is None:
            ds_terrain = terrain.downsample(downsample_factor)
            _router_40m = MartianAStarRouter(ds_terrain)
        return _router_40m

@api_router.get("/datasets", response_model=List[DatasetMetadata])
def get_datasets():
    """List authoritative NASA and USGS planetary datasets integrated into Marswalk."""
    return [
        DatasetMetadata(
            dataset_id="USGS-JEZ-CTX-DTM-20M",
            name="Jezero Controlled CTX Digital Terrain Model",
            instrument="Context Camera (CTX)",
            mission="Mars Reconnaissance Orbiter (MRO)",
            product_type="Digital Elevation Model (DEM)",
            spatial_resolution="20.0 m/pixel",
            crs="Equirectangular Mars 2000 Sphere IAU (Eqc_latTs0_lon0)",
            coverage="Jezero Crater (77.16°E to 77.70°E, 18.21°N to 18.72°N)",
            provenance_url="https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif",
            notes="100% complete coverage across Jezero floor, delta fan, and crater rim."
        ),
        DatasetMetadata(
            dataset_id="NASA-TREK-JEZ-CTX-6M",
            name="Jezero CTX Controlled Orthorectified Image Mosaic",
            instrument="Context Camera (CTX)",
            mission="Mars Reconnaissance Orbiter (MRO)",
            product_type="High-Resolution Orthomosaic (WMTS)",
            spatial_resolution="6.0 m/pixel",
            crs="Equirectangular Mars 2000 Sphere (Plate Carrée)",
            coverage="Jezero Crater bounds",
            provenance_url="https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/",
            notes="Live NASA Mars Trek OGC WMTS tile stream."
        ),
        DatasetMetadata(
            dataset_id="NASA-MOLA-GLOBAL-463M",
            name="Mars Global Color Shaded Relief Mosaic",
            instrument="Mars Orbiter Laser Altimeter (MOLA)",
            mission="Mars Global Surveyor (MGS)",
            product_type="Global Shaded Relief / Topography",
            spatial_resolution="463 m/pixel",
            crs="Equirectangular Mars 2000 Sphere",
            coverage="Global Mars (-180° to 180°, -90° to 90°)",
            provenance_url="https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/",
            notes="Primary planetary contextual basemap."
        ),
        DatasetMetadata(
            dataset_id="USGS-SIM-3464",
            name="Geologic Map of Jezero Crater and Nili Planum",
            instrument="Photogeological and Spectral Synthesis",
            mission="USGS Scientific Investigations Map 3464",
            product_type="Geological Map & Formation Units",
            spatial_resolution="1:75,000 map scale",
            crs="Mars 2000 System",
            coverage="Jezero quadrangle",
            provenance_url="https://doi.org/10.3133/sim3464",
            notes="Provides verified stratigraphic formation boundaries and mineral definitions."
        ),
        DatasetMetadata(
            dataset_id="NASA-M2020-MEDA",
            name="Mars 2020 Environmental Dynamics Analyzer Records",
            instrument="MEDA (ATS, GTS, PS, WS, RDS, HS)",
            mission="Perseverance Rover (Mars 2020)",
            product_type="Direct Surface Meteorology & Dust Opacity",
            spatial_resolution="Point in-situ measurements at Jezero Crater",
            crs="Planetocentric (18.4447°N, 77.4508°E)",
            coverage="Jezero Crater floor traverse",
            provenance_url="https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_meda/",
            notes="Empirical baseline for diurnal temperature, pressure, wind, and atmospheric dust."
        )
    ]

@api_router.get("/layers", response_model=List[LayerDefinition])
def get_layers():
    """List renderable map layers for OpenLayers client."""
    terrain = get_terrain()
    bounds = [terrain.geodesy.lon_min, terrain.geodesy.lat_min, terrain.geodesy.lon_max, terrain.geodesy.lat_max]

    return [
        LayerDefinition(
            layer_id="nasa_jezero_ctx_wmts",
            title="NASA Jezero CTX Mosaic (6m/px)",
            type="wmts",
            url="https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0/default/default028mm/{z}/{y}/{x}.png",
            bounds=bounds,
            attribution="NASA / JPL-Caltech / MSSS / Mars Trek",
            is_base_layer=True,
            default_visible=True,
            opacity=1.0
        ),
        LayerDefinition(
            layer_id="nasa_mola_shaded_relief",
            title="MOLA Global Shaded Relief (463m)",
            type="wmts",
            url="https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg",
            bounds=[-180.0, -90.0, 180.0, 90.0],
            attribution="NASA / GSFC / MOLA Science Team",
            is_base_layer=True,
            default_visible=False,
            opacity=1.0
        ),
        LayerDefinition(
            layer_id="nasa_viking_mdim21",
            title="Viking MDIM 2.1 Color Basemap (232m)",
            type="wmts",
            url="https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg",
            bounds=[-180.0, -90.0, 180.0, 90.0],
            attribution="NASA / USGS Astrogeology",
            is_base_layer=True,
            default_visible=False,
            opacity=1.0
        ),
        LayerDefinition(
            layer_id="jezero_elevation_heatmap",
            title="USGS Topographic Elevation (20m DTM)",
            type="raster_overlay",
            url="/api/v1/terrain/overlay/elevation",
            bounds=bounds,
            attribution="USGS Mars 2020 Terrain Relative Navigation Team",
            is_base_layer=False,
            default_visible=False,
            opacity=0.65
        ),
        LayerDefinition(
            layer_id="jezero_slope_hazards",
            title="Terrain Slope Hazard Map (>15° Red)",
            type="raster_overlay",
            url="/api/v1/terrain/overlay/slope",
            bounds=bounds,
            attribution="Marswalk Geomorphic Hazard Model",
            is_base_layer=False,
            default_visible=True,
            opacity=0.6
        )
    ]

@api_router.get("/coverage", response_model=CoverageResponse)
def get_coverage():
    """Get spatial boundaries and elevation metadata for verified Jezero exploration region."""
    terrain = get_terrain()
    valid_elev = terrain.elevation[~terrain.nodata_mask]
    return CoverageResponse(
        region_name="Jezero Crater, Mars (Western Delta & Floor)",
        bounds_lonlat=[
            round(terrain.geodesy.lon_min, 4),
            round(terrain.geodesy.lat_min, 4),
            round(terrain.geodesy.lon_max, 4),
            round(terrain.geodesy.lat_max, 4)
        ],
        bounds_meters=[
            round(terrain.geodesy.x_min, 1),
            round(terrain.geodesy.y_min, 1),
            round(terrain.geodesy.x_max, 1),
            round(terrain.geodesy.y_max, 1)
        ],
        pixel_size_m=terrain.pixel_size,
        grid_dimensions=[terrain.width, terrain.height],
        elevation_range_m=[round(float(valid_elev.min()), 1), round(float(valid_elev.max()), 1)],
        datum="Mars 2000 Sphere (R = 3,396,190.0 m), MOLA Geoid Vertical Reference"
    )

@api_router.post("/terrain/point", response_model=PointTerrainResponse)
def get_point_terrain(req: PointTerrainRequest):
    """Query surface elevation, slope angle, and traversability at specific coordinates."""
    terrain = get_terrain()
    if not terrain.geodesy.contains_lonlat(req.lon, req.lat):
        return PointTerrainResponse(
            lon=req.lon,
            lat=req.lat,
            elevation_m=None,
            slope_deg=None,
            roughness_m=None,
            is_traversable=False,
            nodata=True
        )

    col, row = terrain.geodesy.lonlat_to_pixel(req.lon, req.lat)
    r = int(round(row))
    c = int(round(col))

    nodata = bool(terrain.nodata_mask[r, c])
    elev = None if nodata else float(terrain.elevation[r, c])
    slope = None if nodata else float(terrain.slope_deg[r, c])
    rough = None if nodata else float(terrain.roughness[r, c])
    traversable = terrain.is_traversable(r, c, max_slope_deg=20.0)

    return PointTerrainResponse(
        lon=req.lon,
        lat=req.lat,
        elevation_m=round(elev, 2) if elev is not None else None,
        slope_deg=round(slope, 2) if slope is not None else None,
        roughness_m=round(rough, 2) if rough is not None else None,
        is_traversable=traversable,
        nodata=nodata
    )

@api_router.get("/terrain/mesh-3d", response_model=TerrainMesh3DResponse)
def get_terrain_mesh_3d(subsample: int = Query(10, ge=4, le=40)):
    """
    Generate downsampled 3D elevation vertex mesh for WebGL / Three.js surface rendering.
    """
    terrain = get_terrain()
    sub_elev = terrain.elevation[::subsample, ::subsample]
    valid = sub_elev[~np.isnan(sub_elev) & (sub_elev > -10000.0)]
    min_elev = float(valid.min()) if len(valid) > 0 else -2500.0
    max_elev = float(valid.max()) if len(valid) > 0 else -1500.0

    clean_elev = np.copy(sub_elev)
    clean_elev[np.isnan(clean_elev) | (clean_elev <= -10000.0)] = min_elev

    h, w = clean_elev.shape
    flat_list = [round(float(val), 1) for val in clean_elev.flatten()]

    return TerrainMesh3DResponse(
        grid_width=w,
        grid_height=h,
        elevations=flat_list,
        min_elev_m=round(min_elev, 1),
        max_elev_m=round(max_elev, 1),
        bounds_lonlat=[
            round(terrain.geodesy.lon_min, 4),
            round(terrain.geodesy.lat_min, 4),
            round(terrain.geodesy.lon_max, 4),
            round(terrain.geodesy.lat_max, 4)
        ],
        bounds_meters=[
            round(terrain.geodesy.x_min, 1),
            round(terrain.geodesy.y_min, 1),
            round(terrain.geodesy.x_max, 1),
            round(terrain.geodesy.y_max, 1)
        ],
        pixel_size_m=terrain.pixel_size * subsample
    )

@api_router.get("/science-targets", response_model=List[ScienceTargetResponse])
def get_science_targets(
    current_lon: Optional[float] = Query(None),
    current_lat: Optional[float] = Query(None)
):
    """List curated science targets, ranked if current coordinates are provided."""
    if current_lon is not None and current_lat is not None:
        targets = _science_catalog.rank_targets(current_lon, current_lat)
    else:
        targets = _science_catalog.list_targets()

    return [
        ScienceTargetResponse(
            target_id=t.target_id,
            name=t.name,
            lon=t.lon,
            lat=t.lat,
            geological_unit=t.geological_unit,
            unit_symbol=t.unit_symbol,
            mineralogy=t.mineralogy,
            scientific_relevance=t.scientific_relevance,
            mineralogical_evidence=t.mineralogical_evidence,
            data_quality=t.data_quality,
            supporting_instrument=t.supporting_instrument,
            supporting_mission=t.supporting_mission,
            product_identifier=t.product_identifier,
            investigation_objective=t.investigation_objective,
            description=t.description,
            composite_score=t.composite_score,
            estimated_distance_m=t.estimated_distance_m
        ) for t in targets
    ]

@api_router.get("/environment")
def get_environment(lmst_hour: float = 12.0, duration_hours: float = 4.0):
    """Query Perseverance MEDA surface observations and radiation exposure."""
    return _environmental_model.get_conditions(lmst_hour=lmst_hour, mission_duration_hours=duration_hours)

@api_router.get("/nasa/weather")
def get_nasa_weather():
    """Retrieve authentic Martian atmospheric telemetry from NASA InSight Weather API."""
    return _nasa_client.get_insight_weather()

@api_router.get("/nasa/media")
def get_nasa_media(query: str = Query("jezero crater", min_length=1), limit: int = Query(10, ge=1, le=50)):
    """Search NASA Image & Video Library for Jezero Crater observations and mission records."""
    return _nasa_client.search_mission_media(query=query, limit=limit)

@api_router.get("/nasa/ephemeris")
def get_nasa_ephemeris():
    """Get real-time Mars orbital ephemeris and solar geometry from NASA JPL Horizons."""
    return _nasa_client.get_mars_ephemeris()

def _build_route_response(route: RouteResult) -> RoutePlanResponse:
    elev_gain = 0.0
    elev_loss = 0.0
    for i in range(1, len(route.elevation_profile)):
        d = route.elevation_profile[i] - route.elevation_profile[i - 1]
        if d > 0:
            elev_gain += d
        else:
            elev_loss += abs(d)

    return RoutePlanResponse(
        mode=route.mode,
        total_distance_m=route.total_distance_m,
        total_distance_km=round(route.total_distance_m / 1000.0, 2),
        estimated_duration_s=route.estimated_duration_s,
        estimated_duration_h=round(route.estimated_duration_s / 3600.0, 2),
        max_slope_deg=route.max_slope_deg,
        avg_slope_deg=route.avg_slope_deg,
        elevation_gain_m=round(elev_gain, 1),
        elevation_loss_m=round(elev_loss, 1),
        coords_lonlat=[[round(c[0], 5), round(c[1], 5)] for c in route.coords_lonlat],
        elevation_profile=[round(e, 1) for e in route.elevation_profile],
        slope_profile=[round(s, 1) for s in route.slope_profile],
        hazard_segments=route.hazard_segments
    )

@api_router.post("/routes/plan", response_model=RoutePlanResponse)
def plan_route(req: RoutePlanRequest):
    """Plan an optimal traverse route between two points on the Martian surface."""
    router = get_router(downsample_factor=2)
    result = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat,
        mode=req.mode,
        max_slope_deg=req.max_slope_deg,
        w_slope=req.w_slope,
        w_roughness=req.w_roughness
    )
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="No traversable route found between coordinates under configured slope limits and hazard constraints."
        )

    return _build_route_response(result)

@api_router.post("/routes/compare", response_model=RouteCompareResponse)
def compare_routes(req: RouteCompareRequest):
    """Generate and compare Shortest Distance, Safe Low-Cost, and Science exploration routes."""
    router = get_router(downsample_factor=2)

    res_shortest = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat,
        mode="shortest",
        max_slope_deg=req.max_slope_deg,
        w_slope=0.0,
        w_roughness=0.0
    )

    res_safe = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat,
        mode="safe",
        max_slope_deg=req.max_slope_deg,
        w_slope=4.0,
        w_roughness=2.5
    )

    routes_dict = {}
    if res_shortest:
        routes_dict["shortest"] = _build_route_response(res_shortest)
    if res_safe:
        routes_dict["safe"] = _build_route_response(res_safe)

    recommendation = "Safe route is recommended: reduces slope fatigue and minimizes suit tipping hazard."
    if res_safe and res_shortest:
        diff_dist = res_safe.total_distance_m - res_shortest.total_distance_m
        diff_slope = res_shortest.avg_slope_deg - res_safe.avg_slope_deg
        recommendation = (
            f"The Safe route adds {diff_dist:.0f}m ({diff_dist/1000.0:.2f} km) in traverse distance, "
            f"but lowers average slope by {diff_slope:.1f}° and avoids steep hazard faces."
        )

    return RouteCompareResponse(
        routes=routes_dict,
        recommendation=recommendation
    )

@api_router.post("/missions/simulate", response_model=MissionSimulateResponse)
def simulate_mission(req: MissionSimulateRequest):
    """Run life-support simulation and assess mission feasibility."""
    cfg = SpacesuitConfig(
        o2_capacity_kg=req.o2_capacity_kg,
        battery_capacity_wh=req.battery_capacity_wh,
        cooling_water_capacity_kg=req.cooling_water_kg,
        mandatory_reserve_pct=req.mandatory_reserve_pct
    )
    sim = MissionSimulator(cfg)
    res = sim.simulate(
        distance_m=req.distance_m,
        walking_time_s=req.walking_time_s,
        science_duration_min=req.science_duration_min,
        contingency_pct=req.contingency_pct
    )

    return MissionSimulateResponse(
        is_feasible=res.is_feasible,
        feasibility_status=res.feasibility_status,
        total_mission_time_h=res.total_mission_time_h,
        walk_time_h=res.walk_time_h,
        science_time_h=res.science_time_h,
        nav_check_time_h=res.nav_check_time_h,
        contingency_time_h=res.contingency_time_h,
        o2_used_kg=res.o2_used_kg,
        o2_remaining_kg=res.o2_remaining_kg,
        o2_remaining_pct=res.o2_remaining_pct,
        battery_used_wh=res.battery_used_wh,
        battery_remaining_wh=res.battery_remaining_wh,
        battery_remaining_pct=res.battery_remaining_pct,
        cooling_water_used_kg=res.cooling_water_used_kg,
        cooling_water_remaining_kg=res.cooling_water_remaining_kg,
        cooling_water_remaining_pct=res.cooling_water_remaining_pct,
        limiting_resource=res.limiting_resource,
        bottlenecks=res.bottlenecks,
        actionable_recommendations=res.actionable_recommendations
    )

@api_router.post("/reports/generate")
def generate_report(req: ReportGenerateRequest):
    """Generate structured mission briefing dossier and markdown report."""
    target = None
    if req.target_id:
        target = _science_catalog.get_target_by_id(req.target_id)

    # Reconstruct route object for reporter
    route_res = RouteResult(
        coords_lonlat=[(c[0], c[1]) for c in req.route_plan.coords_lonlat],
        pixel_path=[],
        elevation_profile=req.route_plan.elevation_profile,
        slope_profile=req.route_plan.slope_profile,
        total_distance_m=req.route_plan.total_distance_m,
        total_cost=0.0,
        max_slope_deg=req.route_plan.max_slope_deg,
        avg_slope_deg=req.route_plan.avg_slope_deg,
        estimated_duration_s=req.route_plan.estimated_duration_s,
        hazard_segments=req.route_plan.hazard_segments,
        mode=req.route_plan.mode
    )

    # Reconstruct simulation result
    sim_res = SimulationResult(
        is_feasible=req.simulation.is_feasible,
        feasibility_status=req.simulation.feasibility_status,
        total_mission_time_h=req.simulation.total_mission_time_h,
        walk_time_h=req.simulation.walk_time_h,
        science_time_h=req.simulation.science_time_h,
        nav_check_time_h=req.simulation.nav_check_time_h,
        contingency_time_h=req.simulation.contingency_time_h,
        o2_used_kg=req.simulation.o2_used_kg,
        o2_remaining_kg=req.simulation.o2_remaining_kg,
        o2_remaining_pct=req.simulation.o2_remaining_pct,
        battery_used_wh=req.simulation.battery_used_wh,
        battery_remaining_wh=req.simulation.battery_remaining_wh,
        battery_remaining_pct=req.simulation.battery_remaining_pct,
        cooling_water_used_kg=req.simulation.cooling_water_used_kg,
        cooling_water_remaining_kg=req.simulation.cooling_water_remaining_kg,
        cooling_water_remaining_pct=req.simulation.cooling_water_remaining_pct,
        limiting_resource=req.simulation.limiting_resource,
        bottlenecks=req.simulation.bottlenecks,
        actionable_recommendations=req.simulation.actionable_recommendations
    )

    briefing = ExpeditionReporter.generate_briefing(
        mission_id=req.mission_id,
        crew_names=req.crew_names,
        start_name=req.start_name,
        start_coords=(req.start_coords[0], req.start_coords[1]),
        target=target,
        route=route_res,
        simulation=sim_res,
        environment=req.environment
    )

    markdown_text = ExpeditionReporter.to_markdown(briefing)

    return {
        "briefing_data": briefing,
        "markdown_report": markdown_text
    }

# -----------------------------------------------------------------------------
# Advanced Intelligence Systems Route Handlers
# -----------------------------------------------------------------------------

@api_router.post("/mobility/estimate", response_model=MobilityResponse)
def estimate_mobility(req: MobilityRequest):
    """Estimate suited astronaut walking speed, metabolic power, fatigue curve, and rest schedule."""
    estimator = MobilityEstimator(astronaut_mass_kg=req.astronaut_mass_kg, suit_mass_kg=req.suit_mass_kg)
    profile = estimator.evaluate_traverse(distances_m=req.distances_m, slopes_deg=req.slopes_deg)
    return MobilityResponse(
        total_distance_m=profile.total_distance_m,
        total_walk_time_s=profile.total_walk_time_s,
        total_rest_time_s=profile.total_rest_time_s,
        total_elapsed_time_s=profile.total_elapsed_time_s,
        avg_speed_ms=profile.avg_speed_ms,
        avg_metabolic_power_w=profile.avg_metabolic_power_w,
        peak_metabolic_power_w=profile.peak_metabolic_power_w,
        total_energy_kcal=profile.total_energy_kcal,
        peak_fatigue_pct=profile.peak_fatigue_pct,
        fatigue_curve=profile.fatigue_curve,
        speed_profile=profile.speed_profile,
        power_profile=profile.power_profile,
        rest_stops=[
            RestScheduleSchema(
                step_index=r.step_index,
                distance_along_route_m=r.distance_along_route_m,
                elapsed_time_s=r.elapsed_time_s,
                rest_duration_min=r.rest_duration_min,
                fatigue_before_pct=r.fatigue_before_pct,
                fatigue_after_pct=r.fatigue_after_pct,
                reason=r.reason
            ) for r in profile.rest_stops
        ]
    )

@api_router.post("/returnability/evaluate", response_model=ReturnabilityResponse)
def evaluate_returnability(req: ReturnabilityRequest):
    """Evaluate returnability along route checkpoints and locate the Point of No Return."""
    router = get_router(2)
    outbound = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat
    )
    if not outbound:
        raise HTTPException(status_code=400, detail="Unable to plan valid outbound route")

    engine = get_returnability_engine()
    eval_res = engine.evaluate_route_returnability(
        outbound_route=outbound,
        habitat_lon=req.start_lon,
        habitat_lat=req.start_lat,
        o2_capacity_kg=req.o2_capacity_kg,
        battery_capacity_wh=req.battery_capacity_wh,
        water_capacity_kg=req.water_capacity_kg
    )

    preferred_return_resp = _build_route_response(eval_res.preferred_return_route) if eval_res.preferred_return_route else None

    return ReturnabilityResponse(
        overall_status=eval_res.overall_status.value,
        checkpoints=[
            ReturnCheckpointSchema(
                step_index=c.step_index,
                lon=c.lon,
                lat=c.lat,
                outbound_elapsed_s=c.outbound_elapsed_s,
                return_distance_m=c.return_distance_m,
                return_duration_s=c.return_duration_s,
                o2_return_required_kg=c.o2_return_required_kg,
                battery_return_required_wh=c.battery_return_required_wh,
                water_return_required_kg=c.water_return_required_kg,
                remaining_o2_margin_pct=c.remaining_o2_margin_pct,
                status=c.status.value
            ) for c in eval_res.checkpoints
        ],
        point_of_no_return_idx=eval_res.point_of_no_return_idx,
        point_of_no_return_lonlat=list(eval_res.point_of_no_return_lonlat) if eval_res.point_of_no_return_lonlat else None,
        min_return_margin_pct=eval_res.min_return_margin_pct,
        preferred_return_route=preferred_return_resp,
        limiting_resource=eval_res.limiting_resource,
        summary=eval_res.summary
    )

@api_router.post("/returnability/emergency", response_model=EmergencyEventResponse)
def assess_emergency(req: EmergencyEventRequest):
    """Simulate off-nominal emergency event (mobility deficit, leak) and compute escape response."""
    engine = get_returnability_engine()
    assessment = engine.assess_emergency_event(
        current_lon=req.current_lon,
        current_lat=req.current_lat,
        habitat_lon=req.habitat_lon,
        habitat_lat=req.habitat_lat,
        speed_factor=req.speed_factor,
        remaining_o2_kg=req.remaining_o2_kg,
        remaining_battery_wh=req.remaining_battery_wh,
        remaining_water_kg=req.remaining_water_kg
    )
    return_route = _build_route_response(assessment.emergency_return_route) if assessment.emergency_return_route else None
    return EmergencyEventResponse(
        action_recommendation=assessment.action_recommendation,
        urgency_level=assessment.urgency_level,
        reasoning=assessment.reasoning,
        emergency_return_route=return_route,
        required_return_time_s=assessment.required_return_time_s,
        estimated_o2_used_kg=assessment.estimated_o2_used_kg,
        projected_final_o2_reserve_pct=assessment.projected_final_o2_reserve_pct
    )

@api_router.post("/confidence/evaluate", response_model=ConfidenceResponse)
def evaluate_mission_confidence(req: ConfidenceRequest):
    """Evaluate multi-dimensional mission reliability across terrain, route, environment, and life support."""
    router = get_router(2)
    route = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat
    )
    if not route:
        raise HTTPException(status_code=400, detail="Cannot plan route for confidence evaluation")

    sim = MissionSimulator().simulate(
        distance_m=route.total_distance_m,
        walking_time_s=route.estimated_duration_s,
        science_duration_min=req.science_dwell_min
    )
    engine = get_confidence_engine()
    res = engine.evaluate_confidence(route=route, simulation=sim, has_real_insitu_env=req.has_real_insitu_env)
    return ConfidenceResponse(
        overall_score=res.overall_score,
        confidence_level=res.confidence_level,
        terrain_confidence=res.terrain_confidence,
        route_confidence=res.route_confidence,
        environment_confidence=res.environment_confidence,
        resource_confidence=res.resource_confidence,
        feasibility_confidence=res.feasibility_confidence,
        uncertainty_drivers=res.uncertainty_drivers,
        actionable_mitigations=res.actionable_mitigations
    )

@api_router.post("/confidence/monte-carlo", response_model=MonteCarloResponse)
def run_monte_carlo_scenarios(req: MonteCarloRequest):
    """Run stochastic Monte Carlo simulations to assess mission success rate and duration distributions."""
    router = get_router(2)
    route = router.plan_lonlat_route(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        goal_lon=req.goal_lon,
        goal_lat=req.goal_lat
    )
    if not route:
        raise HTTPException(status_code=400, detail="Cannot plan route for Monte Carlo analysis")

    engine = get_confidence_engine()
    mc = engine.run_monte_carlo(route=route, num_simulations=req.num_simulations, science_dwell_min=req.science_dwell_min)
    return MonteCarloResponse(
        num_runs=mc.num_runs,
        success_rate_pct=mc.success_rate_pct,
        duration_p10_h=mc.duration_p10_h,
        duration_p50_h=mc.duration_p50_h,
        duration_p90_h=mc.duration_p90_h,
        o2_margin_p10_pct=mc.o2_margin_p10_pct,
        o2_margin_p50_pct=mc.o2_margin_p50_pct,
        duration_samples_h=mc.duration_samples_h,
        failure_breakdown=mc.failure_breakdown
    )

@api_router.get("/confidence/sensitivity", response_model=SensitivityResponse)
def get_sensitivity_analysis(start_lon: float, start_lat: float, goal_lon: float, goal_lat: float):
    """Analyze elasticity of mission duration and safety margins to walking speed, slope, and O2 usage."""
    router = get_router(2)
    route = router.plan_lonlat_route(start_lon=start_lon, start_lat=start_lat, goal_lon=goal_lon, goal_lat=goal_lat)
    if not route:
        raise HTTPException(status_code=400, detail="Cannot plan route for sensitivity analysis")

    engine = get_confidence_engine()
    sens = engine.analyze_sensitivity(route=route)
    return SensitivityResponse(
        parameter_elasticities=sens.parameter_elasticities,
        primary_failure_mode=sens.primary_failure_mode,
        recommendation=sens.recommendation
    )

@api_router.get("/science/discover", response_model=List[DiscoveredTargetSchema])
def discover_science_targets(current_lon: float, current_lat: float, radius_m: float = 12000.0, min_relevance: float = 6.0):
    """Autonomously discover scientific targets ranked by Scientific Value Density (SVD)."""
    engine = get_discovery_engine()
    targets = engine.discover_targets(current_lon=current_lon, current_lat=current_lat, max_search_radius_m=radius_m, min_relevance=min_relevance)
    return [
        DiscoveredTargetSchema(
            target_id=t.target_id,
            name=t.name,
            lon=t.lon,
            lat=t.lat,
            geological_unit=t.geological_unit,
            mineralogy=t.mineralogy,
            relevance=t.relevance,
            data_quality=t.data_quality,
            distance_m=t.distance_m,
            scientific_value_density=t.scientific_value_density,
            recommended_instrument=t.recommended_instrument,
            evidence_summary=t.evidence_summary
        ) for t in targets
    ]

@api_router.post("/science/tour", response_model=ScienceTourResponse)
def optimize_science_tour(req: ScienceTourRequest):
    """Synthesize multi-stop exploration itinerary maximizing scientific value within time budget."""
    engine = get_discovery_engine()
    tour = engine.optimize_science_tour(
        start_lon=req.start_lon,
        start_lat=req.start_lat,
        time_budget_h=req.time_budget_h,
        dwell_per_stop_min=req.dwell_per_stop_min
    )
    return ScienceTourResponse(
        stops=[
            TourStopSchema(
                stop_number=s.stop_number,
                target_id=s.target_id,
                name=s.name,
                lon=s.lon,
                lat=s.lat,
                arrival_time_min=s.arrival_time_min,
                dwell_time_min=s.dwell_time_min,
                science_value=s.science_value
            ) for s in tour.stops
        ],
        total_distance_km=tour.total_distance_km,
        total_duration_h=tour.total_duration_h,
        total_science_value=tour.total_science_value,
        return_feasible=tour.return_feasible,
        itinerary_summary=tour.itinerary_summary
    )

@api_router.get("/habitat/candidates", response_model=List[HabitatCandidateSchema])
def get_habitat_candidates():
    """Retrieve evaluated candidate exploration bases across Jezero Crater ranked by MCDA suitability."""
    engine = get_habitat_engine()
    cands = engine.evaluate_candidates()
    return [
        HabitatCandidateSchema(
            site_id=c.site_id,
            name=c.name,
            lon=c.lon,
            lat=c.lat,
            elevation_m=c.elevation_m,
            slope_deg=c.slope_deg,
            roughness_m=c.roughness_m,
            composite_suitability=c.composite_suitability,
            classification=c.classification,
            criteria_scores=c.criteria_scores,
            pros=c.pros,
            cons=c.cons,
            operational_capacity=c.operational_capacity
        ) for c in cands
    ]
