"""
Pydantic v2 Data Transfer Objects (DTOs) for the Marswalk REST API.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class DatasetMetadata(BaseModel):
    dataset_id: str
    name: str
    instrument: str
    mission: str
    product_type: str
    spatial_resolution: str
    crs: str
    coverage: str
    provenance_url: str
    notes: str

class LayerDefinition(BaseModel):
    layer_id: str
    title: str
    type: str # 'wmts', 'raster_overlay', 'vector_geojson'
    url: Optional[str] = None
    bounds: List[float] # [min_lon, min_lat, max_lon, max_lat]
    attribution: str
    is_base_layer: bool
    default_visible: bool
    opacity: float = 1.0

class CoverageResponse(BaseModel):
    region_name: str
    bounds_lonlat: List[float] # [min_lon, min_lat, max_lon, max_lat]
    bounds_meters: List[float] # [min_x, min_y, max_x, max_y]
    pixel_size_m: float
    grid_dimensions: List[int] # [width, height]
    elevation_range_m: List[float] # [min_elev, max_elev]
    datum: str

class PointTerrainRequest(BaseModel):
    lon: float = Field(..., ge=-180.0, le=180.0)
    lat: float = Field(..., ge=-90.0, le=90.0)

class PointTerrainResponse(BaseModel):
    lon: float
    lat: float
    elevation_m: Optional[float]
    slope_deg: Optional[float]
    roughness_m: Optional[float]
    is_traversable: bool
    nodata: bool

class TerrainMesh3DResponse(BaseModel):
    grid_width: int
    grid_height: int
    elevations: List[float] # flattened row-major list
    min_elev_m: float
    max_elev_m: float
    bounds_lonlat: List[float] # [min_lon, min_lat, max_lon, max_lat]
    bounds_meters: List[float] # [min_x, min_y, max_x, max_y]
    pixel_size_m: float

class ScienceTargetResponse(BaseModel):
    target_id: str
    name: str
    lon: float
    lat: float
    geological_unit: str
    unit_symbol: str
    mineralogy: str
    scientific_relevance: float
    mineralogical_evidence: float
    data_quality: float
    supporting_instrument: str
    supporting_mission: str
    product_identifier: str
    investigation_objective: str
    description: str
    composite_score: Optional[float] = None
    estimated_distance_m: Optional[float] = None

class EnvironmentRequest(BaseModel):
    lmst_hour: float = Field(12.0, ge=0.0, le=24.0)
    duration_hours: float = Field(4.0, ge=0.5, le=12.0)

class RoutePlanRequest(BaseModel):
    start_lon: float = Field(..., ge=-180.0, le=180.0)
    start_lat: float = Field(..., ge=-90.0, le=90.0)
    goal_lon: float = Field(..., ge=-180.0, le=180.0)
    goal_lat: float = Field(..., ge=-90.0, le=90.0)
    mode: str = Field("safe", description="'safe', 'shortest', or 'science'")
    max_slope_deg: float = Field(20.0, ge=5.0, le=45.0)
    w_slope: float = Field(3.0, ge=0.0, le=20.0)
    w_roughness: float = Field(2.0, ge=0.0, le=10.0)

class RoutePlanResponse(BaseModel):
    mode: str
    total_distance_m: float
    total_distance_km: float
    estimated_duration_s: float
    estimated_duration_h: float
    max_slope_deg: float
    avg_slope_deg: float
    elevation_gain_m: float
    elevation_loss_m: float
    coords_lonlat: List[List[float]]
    elevation_profile: List[float]
    slope_profile: List[float]
    hazard_segments: List[Dict[str, Any]]

class RouteCompareRequest(BaseModel):
    start_lon: float
    start_lat: float
    goal_lon: float
    goal_lat: float
    max_slope_deg: float = 20.0

class RouteCompareResponse(BaseModel):
    routes: Dict[str, RoutePlanResponse]
    recommendation: str

class MissionSimulateRequest(BaseModel):
    distance_m: float = Field(..., ge=0.0)
    walking_time_s: float = Field(..., ge=0.0)
    science_duration_min: float = Field(45.0, ge=0.0, le=360.0)
    contingency_pct: float = Field(15.0, ge=0.0, le=50.0)
    o2_capacity_kg: float = Field(1.20, ge=0.5, le=5.0)
    battery_capacity_wh: float = Field(1000.0, ge=200.0, le=5000.0)
    cooling_water_kg: float = Field(4.0, ge=1.0, le=15.0)
    mandatory_reserve_pct: float = Field(20.0, ge=5.0, le=40.0)

class MissionSimulateResponse(BaseModel):
    is_feasible: bool
    feasibility_status: str
    total_mission_time_h: float
    walk_time_h: float
    science_time_h: float
    nav_check_time_h: float
    contingency_time_h: float
    o2_used_kg: float
    o2_remaining_kg: float
    o2_remaining_pct: float
    battery_used_wh: float
    battery_remaining_wh: float
    battery_remaining_pct: float
    cooling_water_used_kg: float
    cooling_water_remaining_kg: float
    cooling_water_remaining_pct: float
    limiting_resource: str
    bottlenecks: List[str]
    actionable_recommendations: List[str]

class ReportGenerateRequest(BaseModel):
    mission_id: str = "EVA-JEZERO-01"
    crew_names: List[str] = Field(default_factory=lambda: ["A. Rodriguez", "T. Chen"])
    start_name: str = "Octavia E. Butler Base"
    start_coords: List[float] # [lon, lat]
    target_id: Optional[str] = None
    target_name: Optional[str] = None
    route_plan: RoutePlanResponse
    simulation: MissionSimulateResponse
    environment: Dict[str, Any]

# --- Human Mobility Schemas ---
class MobilityRequest(BaseModel):
    distances_m: List[float]
    slopes_deg: List[float]
    astronaut_mass_kg: float = 80.0
    suit_mass_kg: float = 120.0

class RestScheduleSchema(BaseModel):
    step_index: int
    distance_along_route_m: float
    elapsed_time_s: float
    rest_duration_min: float
    fatigue_before_pct: float
    fatigue_after_pct: float
    reason: str

class MobilityResponse(BaseModel):
    total_distance_m: float
    total_walk_time_s: float
    total_rest_time_s: float
    total_elapsed_time_s: float
    avg_speed_ms: float
    avg_metabolic_power_w: float
    peak_metabolic_power_w: float
    total_energy_kcal: float
    peak_fatigue_pct: float
    fatigue_curve: List[float]
    speed_profile: List[float]
    power_profile: List[float]
    rest_stops: List[RestScheduleSchema]

# --- Returnability Schemas ---
class ReturnabilityRequest(BaseModel):
    start_lon: float
    start_lat: float
    goal_lon: float
    goal_lat: float
    o2_capacity_kg: float = 1.20
    battery_capacity_wh: float = 1000.0
    water_capacity_kg: float = 4.0

class ReturnCheckpointSchema(BaseModel):
    step_index: int
    lon: float
    lat: float
    outbound_elapsed_s: float
    return_distance_m: float
    return_duration_s: float
    o2_return_required_kg: float
    battery_return_required_wh: float
    water_return_required_kg: float
    remaining_o2_margin_pct: float
    status: str

class ReturnabilityResponse(BaseModel):
    overall_status: str
    checkpoints: List[ReturnCheckpointSchema]
    point_of_no_return_idx: int
    point_of_no_return_lonlat: Optional[List[float]]
    min_return_margin_pct: float
    preferred_return_route: Optional[RoutePlanResponse]
    limiting_resource: str
    summary: str

class EmergencyEventRequest(BaseModel):
    current_lon: float
    current_lat: float
    habitat_lon: float
    habitat_lat: float
    speed_factor: float = 1.0
    remaining_o2_kg: float = 0.8
    remaining_battery_wh: float = 600.0
    remaining_water_kg: float = 2.5

class EmergencyEventResponse(BaseModel):
    action_recommendation: str
    urgency_level: str
    reasoning: List[str]
    emergency_return_route: Optional[RoutePlanResponse]
    required_return_time_s: float
    estimated_o2_used_kg: float
    projected_final_o2_reserve_pct: float

# --- Mission Confidence Schemas ---
class ConfidenceRequest(BaseModel):
    start_lon: float
    start_lat: float
    goal_lon: float
    goal_lat: float
    science_dwell_min: float = 45.0
    has_real_insitu_env: bool = True

class ConfidenceResponse(BaseModel):
    overall_score: float
    confidence_level: str
    terrain_confidence: float
    route_confidence: float
    environment_confidence: float
    resource_confidence: float
    feasibility_confidence: float
    uncertainty_drivers: List[str]
    actionable_mitigations: List[str]

class MonteCarloRequest(BaseModel):
    start_lon: float
    start_lat: float
    goal_lon: float
    goal_lat: float
    num_simulations: int = 100
    science_dwell_min: float = 45.0

class MonteCarloResponse(BaseModel):
    num_runs: int
    success_rate_pct: float
    duration_p10_h: float
    duration_p50_h: float
    duration_p90_h: float
    o2_margin_p10_pct: float
    o2_margin_p50_pct: float
    duration_samples_h: List[float]
    failure_breakdown: Dict[str, int]

class SensitivityResponse(BaseModel):
    parameter_elasticities: Dict[str, float]
    primary_failure_mode: str
    recommendation: str

# --- Autonomous Science Discovery Schemas ---
class DiscoveredTargetSchema(BaseModel):
    target_id: str
    name: str
    lon: float
    lat: float
    geological_unit: str
    mineralogy: str
    relevance: float
    data_quality: float
    distance_m: float
    scientific_value_density: float
    recommended_instrument: str
    evidence_summary: str

class TourStopSchema(BaseModel):
    stop_number: int
    target_id: str
    name: str
    lon: float
    lat: float
    arrival_time_min: float
    dwell_time_min: float
    science_value: float

class ScienceTourRequest(BaseModel):
    start_lon: float
    start_lat: float
    time_budget_h: float = 4.0
    dwell_per_stop_min: float = 30.0

class ScienceTourResponse(BaseModel):
    stops: List[TourStopSchema]
    total_distance_km: float
    total_duration_h: float
    total_science_value: float
    return_feasible: bool
    itinerary_summary: str

# --- Habitat Selection Schemas ---
class HabitatCandidateSchema(BaseModel):
    site_id: str
    name: str
    lon: float
    lat: float
    elevation_m: float
    slope_deg: float
    roughness_m: float
    composite_suitability: float
    classification: str
    criteria_scores: Dict[str, float]
    pros: List[str]
    cons: List[str]
    operational_capacity: str
