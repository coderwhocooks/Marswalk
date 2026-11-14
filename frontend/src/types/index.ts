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
