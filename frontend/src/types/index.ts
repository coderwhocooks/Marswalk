export interface DatasetMetadata {
  dataset_id: string;
  name: string;
  instrument: string;
  mission: string;
  product_type: string;
  spatial_resolution: string;
  crs: string;
  coverage: string;
  provenance_url: string;
  notes: string;
}

export interface LayerDefinition {
  layer_id: string;
  title: string;
  type: string;
  url?: string;
  bounds: [number, number, number, number];
  attribution: string;
  is_base_layer: boolean;
  default_visible: boolean;
  opacity: number;
}

export interface CoverageResponse {
  region_name: string;
  bounds_lonlat: [number, number, number, number];
  bounds_meters: [number, number, number, number];
  pixel_size_m: number;
  grid_dimensions: [number, number];
  elevation_range_m: [number, number];
  datum: string;
}

export interface ScienceTarget {
  target_id: string;
  name: string;
  lon: number;
  lat: number;
  geological_unit: string;
  unit_symbol: string;
  mineralogy: string;
  scientific_relevance: number;
  mineralogical_evidence: number;
  data_quality: number;
  supporting_instrument: string;
  supporting_mission: string;
  product_identifier: string;
  investigation_objective: string;
  description: string;
  composite_score?: number;
  estimated_distance_m?: number;
}

export interface EnvironmentalConditions {
  lmst_hour: number;
  surface_temp_c: number;
  air_temp_c: number;
  pressure_pa: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  dust_optical_depth: number;
  relative_humidity_pct: number;
  solar_elevation_deg: number;
  solar_flux_wm2: number;
  radiation_dose_msv: number;
  provenance: {
    atmospheric_sensor: string;
    radiation_sensor: string;
    observation_location: string;
    classification: string;
  };
}

export interface RoutePlanResponse {
  mode: string;
  total_distance_m: number;
  total_distance_km: number;
  estimated_duration_s: number;
  estimated_duration_h: number;
  max_slope_deg: number;
  avg_slope_deg: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  coords_lonlat: [number, number][];
  elevation_profile: number[];
  slope_profile: number[];
  hazard_segments: Array<{
    index: number;
    lon: number;
    lat: number;
    slope_deg: number;
    hazard_type: string;
  }>;
}

export interface RouteCompareResponse {
  routes: {
    [mode: string]: RoutePlanResponse;
  };
  recommendation: string;
}

export interface MissionSimulateResponse {
  is_feasible: boolean;
  feasibility_status: string;
  total_mission_time_h: number;
  walk_time_h: number;
  science_time_h: number;
  nav_check_time_h: number;
  contingency_time_h: number;
  o2_used_kg: number;
  o2_remaining_kg: number;
  o2_remaining_pct: number;
  battery_used_wh: number;
  battery_remaining_wh: number;
  battery_remaining_pct: number;
  cooling_water_used_kg: number;
  cooling_water_remaining_kg: number;
  cooling_water_remaining_pct: number;
  limiting_resource: string;
  bottlenecks: string[];
  actionable_recommendations: string[];
}

export interface PointTerrainResponse {
  lon: number;
  lat: number;
  elevation_m: number | null;
  slope_deg: number | null;
  roughness_m: number | null;
  is_traversable: boolean;
  nodata: boolean;
}

export interface TerrainMesh3DResponse {
  grid_width: number;
  grid_height: number;
  elevations: number[];
  min_elev_m: number;
  max_elev_m: number;
  bounds_lonlat: [number, number, number, number];
  bounds_meters: [number, number, number, number];
  pixel_size_m: number;
}

// --- Human Mobility ---
export interface RestSchedule {
  step_index: number;
  distance_along_route_m: number;
  elapsed_time_s: number;
  rest_duration_min: number;
  fatigue_before_pct: number;
  fatigue_after_pct: number;
  reason: string;
}

export interface MobilityResponse {
  total_distance_m: number;
  total_walk_time_s: number;
  total_rest_time_s: number;
  total_elapsed_time_s: number;
  avg_speed_ms: number;
  avg_metabolic_power_w: number;
  peak_metabolic_power_w: number;
  total_energy_kcal: number;
  peak_fatigue_pct: number;
  fatigue_curve: number[];
  speed_profile: number[];
  power_profile: number[];
  rest_stops: RestSchedule[];
}

// --- Returnability ---
export interface ReturnCheckpoint {
  step_index: number;
  lon: number;
  lat: number;
  outbound_elapsed_s: number;
  return_distance_m: number;
  return_duration_s: number;
  o2_return_required_kg: number;
  battery_return_required_wh: number;
  water_return_required_kg: number;
  remaining_o2_margin_pct: number;
  status: 'FEASIBLE' | 'FEASIBLE_REDUCED_CONTINGENCY' | 'CONSTRAINED' | 'INFEASIBLE' | 'UNKNOWN';
}

export interface ReturnabilityResponse {
  overall_status: string;
  checkpoints: ReturnCheckpoint[];
  point_of_no_return_idx: number;
  point_of_no_return_lonlat: [number, number] | null;
  min_return_margin_pct: number;
  preferred_return_route: RoutePlanResponse | null;
  limiting_resource: string;
  summary: string;
}

export interface EmergencyEventResponse {
  action_recommendation: 'CONTINUE' | 'REPLAN' | 'RETURN_NOW' | 'ABORT_DIRECT';
  urgency_level: 'NOMINAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  reasoning: string[];
  emergency_return_route: RoutePlanResponse | null;
  required_return_time_s: number;
  estimated_o2_used_kg: number;
  projected_final_o2_reserve_pct: number;
}

// --- Mission Confidence ---
export interface ConfidenceResponse {
  overall_score: number;
  confidence_level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'CRITICAL';
  terrain_confidence: number;
  route_confidence: number;
  environment_confidence: number;
  resource_confidence: number;
  feasibility_confidence: number;
  uncertainty_drivers: string[];
  actionable_mitigations: string[];
}

export interface MonteCarloResponse {
  num_runs: number;
  success_rate_pct: number;
  duration_p10_h: number;
  duration_p50_h: number;
  duration_p90_h: number;
  o2_margin_p10_pct: number;
  o2_margin_p50_pct: number;
  duration_samples_h: number[];
  failure_breakdown: Record<string, number>;
}

export interface SensitivityResponse {
  parameter_elasticities: Record<string, number>;
  primary_failure_mode: string;
  recommendation: string;
}

// --- Autonomous Science Discovery ---
export interface DiscoveredTarget {
  target_id: string;
  name: string;
  lon: number;
  lat: number;
  geological_unit: string;
  mineralogy: string;
  relevance: number;
  data_quality: number;
  distance_m: number;
  scientific_value_density: number;
  recommended_instrument: string;
  evidence_summary: string;
}

export interface TourStop {
  stop_number: number;
  target_id: string;
  name: string;
  lon: number;
  lat: number;
  arrival_time_min: number;
  dwell_time_min: number;
  science_value: number;
}

export interface ScienceTourResponse {
  stops: TourStop[];
  total_distance_km: number;
  total_duration_h: number;
  total_science_value: number;
  return_feasible: boolean;
  itinerary_summary: string;
}

// --- Dynamic Habitat Base Selection ---
export interface HabitatCandidate {
  site_id: string;
  name: string;
  lon: number;
  lat: number;
  elevation_m: number;
  slope_deg: number;
  roughness_m: number;
  composite_suitability: number;
  classification: 'OPTIMAL' | 'FAVORABLE' | 'MARGINAL' | 'UNSUITABLE';
  criteria_scores: Record<string, number>;
  pros: string[];
  cons: string[];
  operational_capacity: string;
}

// --- NASA API Types ---
export interface NasaWeatherResponse {
  sol_keys: string[];
  latest_sol: string;
  air_temp: {
    av: number;
    mn: number;
    mx: number;
    unit: string;
  };
  pressure: {
    av: number;
    mn: number;
    mx: number;
    unit: string;
  };
  wind_speed: {
    av: number;
    mn: number;
    mx: number;
    unit: string;
  };
  wind_direction: {
    compass_point: string;
    compass_degrees: number;
  };
  season: {
    season: string;
    northern_season: string;
    southern_season: string;
  };
  first_utc: string;
  last_utc: string;
  data_source: string;
  is_cached: boolean;
}

export interface NasaMediaItem {
  nasa_id: string;
  title: string;
  description: string;
  date_created: string;
  center: string;
  image_url: string;
  thumb_url: string;
}
