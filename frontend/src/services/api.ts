import {
  DatasetMetadata,
  LayerDefinition,
  CoverageResponse,
  ScienceTarget,
  EnvironmentalConditions,
  RoutePlanResponse,
  RouteCompareResponse,
  MissionSimulateResponse,
  PointTerrainResponse
} from '../types';

const API_BASE = '/api/v1';

export async function fetchDatasets(): Promise<DatasetMetadata[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function fetchLayers(): Promise<LayerDefinition[]> {
  const res = await fetch(`${API_BASE}/layers`);
  if (!res.ok) throw new Error('Failed to fetch map layers');
  return res.json();
}

export async function fetchCoverage(): Promise<CoverageResponse> {
  const res = await fetch(`${API_BASE}/coverage`);
  if (!res.ok) throw new Error('Failed to fetch coverage bounds');
  return res.json();
}

export async function fetchPointTerrain(lon: number, lat: number): Promise<PointTerrainResponse> {
  const res = await fetch(`${API_BASE}/terrain/point`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lon, lat })
  });
  if (!res.ok) throw new Error('Failed to query terrain point');
  return res.json();
}

export async function fetchScienceTargets(currentLon?: number, currentLat?: number): Promise<ScienceTarget[]> {
  const params = new URLSearchParams();
  if (currentLon !== undefined && currentLat !== undefined) {
    params.set('current_lon', currentLon.toString());
    params.set('current_lat', currentLat.toString());
  }
  const url = `${API_BASE}/science-targets${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch science targets');
  return res.json();
}

export async function fetchEnvironment(lmstHour: number = 12.0, durationHours: number = 4.0): Promise<EnvironmentalConditions> {
  const res = await fetch(`${API_BASE}/environment?lmst_hour=${lmstHour}&duration_hours=${durationHours}`);
  if (!res.ok) throw new Error('Failed to fetch environmental data');
  return res.json();
}

export async function planRoute(params: {
  startLon: number;
  startLat: number;
  goalLon: number;
  goalLat: number;
  mode?: string;
  maxSlopeDeg?: number;
  wSlope?: number;
  wRoughness?: number;
}): Promise<RoutePlanResponse> {
  const res = await fetch(`${API_BASE}/routes/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      goal_lon: params.goalLon,
      goal_lat: params.goalLat,
      mode: params.mode || 'safe',
      max_slope_deg: params.maxSlopeDeg ?? 20.0,
      w_slope: params.wSlope ?? 3.0,
      w_roughness: params.wRoughness ?? 2.0
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Path planning failed');
  }
  return res.json();
}

export async function compareRoutes(params: {
  startLon: number;
  startLat: number;
  goalLon: number;
  goalLat: number;
  maxSlopeDeg?: number;
}): Promise<RouteCompareResponse> {
  const res = await fetch(`${API_BASE}/routes/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      goal_lon: params.goalLon,
      goal_lat: params.goalLat,
      max_slope_deg: params.maxSlopeDeg ?? 20.0
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Route comparison failed');
  }
  return res.json();
}

export async function simulateMission(params: {
  distanceM: number;
  walkingTimeS: number;
  scienceDurationMin?: number;
  contingencyPct?: number;
  o2CapacityKg?: number;
  batteryCapacityWh?: number;
  coolingWaterKg?: number;
  mandatoryReservePct?: number;
}): Promise<MissionSimulateResponse> {
  const res = await fetch(`${API_BASE}/missions/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      distance_m: params.distanceM,
      walking_time_s: params.walkingTimeS,
      science_duration_min: params.scienceDurationMin ?? 45.0,
      contingency_pct: params.contingencyPct ?? 15.0,
      o2_capacity_kg: params.o2CapacityKg ?? 1.20,
      battery_capacity_wh: params.batteryCapacityWh ?? 1000.0,
      cooling_water_kg: params.coolingWaterKg ?? 4.0,
      mandatory_reserve_pct: params.mandatoryReservePct ?? 20.0
    })
  });
  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function generateReport(params: {
  missionId: string;
  crewNames: string[];
  startName: string;
  startCoords: [number, number];
  targetId?: string;
  targetName?: string;
  routePlan: RoutePlanResponse;
  simulation: MissionSimulateResponse;
  environment: EnvironmentalConditions;
}): Promise<{ briefing_data: any; markdown_report: string }> {
  const res = await fetch(`${API_BASE}/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mission_id: params.missionId,
      crew_names: params.crewNames,
      start_name: params.startName,
      start_coords: params.startCoords,
      target_id: params.targetId,
      target_name: params.targetName,
      route_plan: params.routePlan,
      simulation: params.simulation,
      environment: params.environment
    })
  });
  if (!res.ok) throw new Error('Report generation failed');
  return res.json();
}
