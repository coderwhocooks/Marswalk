import {
  DatasetMetadata,
  LayerDefinition,
  CoverageResponse,
  ScienceTarget,
  EnvironmentalConditions,
  RoutePlanResponse,
  RouteCompareResponse,
  MissionSimulateResponse,
  PointTerrainResponse,
  TerrainMesh3DResponse,
  MobilityResponse,
  ReturnabilityResponse,
  EmergencyEventResponse,
  ConfidenceResponse,
  MonteCarloResponse,
  SensitivityResponse,
  DiscoveredTarget,
  ScienceTourResponse,
  HabitatCandidate,
  NasaWeatherResponse,
  NasaMediaItem
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

export async function fetchTerrainMesh3D(subsample: number = 10): Promise<TerrainMesh3DResponse> {
  const res = await fetch(`${API_BASE}/terrain/mesh-3d?subsample=${subsample}`);
  if (!res.ok) throw new Error('Failed to fetch 3D terrain mesh');
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

// --- Advanced Intelligence Systems ---

export async function estimateMobility(params: {
  distancesM: number[];
  slopesDeg: number[];
  astronautMassKg?: number;
  suitMassKg?: number;
}): Promise<MobilityResponse> {
  const res = await fetch(`${API_BASE}/mobility/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      distances_m: params.distancesM,
      slopes_deg: params.slopesDeg,
      astronaut_mass_kg: params.astronautMassKg ?? 80.0,
      suit_mass_kg: params.suitMassKg ?? 120.0
    })
  });
  if (!res.ok) throw new Error('Mobility estimation failed');
  return res.json();
}

export async function evaluateReturnability(params: {
  startLon: number;
  startLat: number;
  goalLon: number;
  goalLat: number;
  o2CapacityKg?: number;
  batteryCapacityWh?: number;
  waterCapacityKg?: number;
}): Promise<ReturnabilityResponse> {
  const res = await fetch(`${API_BASE}/returnability/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      goal_lon: params.goalLon,
      goal_lat: params.goalLat,
      o2_capacity_kg: params.o2CapacityKg ?? 1.20,
      battery_capacity_wh: params.batteryCapacityWh ?? 1000.0,
      water_capacity_kg: params.waterCapacityKg ?? 4.0
    })
  });
  if (!res.ok) throw new Error('Returnability evaluation failed');
  return res.json();
}

export async function assessEmergencyEvent(params: {
  currentLon: number;
  currentLat: number;
  habitatLon: number;
  habitatLat: number;
  speedFactor?: number;
  remainingO2Kg?: number;
}): Promise<EmergencyEventResponse> {
  const res = await fetch(`${API_BASE}/returnability/emergency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current_lon: params.currentLon,
      current_lat: params.currentLat,
      habitat_lon: params.habitatLon,
      habitat_lat: params.habitatLat,
      speed_factor: params.speedFactor ?? 1.0,
      remaining_o2_kg: params.remainingO2Kg ?? 0.8
    })
  });
  if (!res.ok) throw new Error('Emergency assessment failed');
  return res.json();
}

export async function evaluateConfidence(params: {
  startLon: number;
  startLat: number;
  goalLon: number;
  goalLat: number;
  scienceDwellMin?: number;
  hasRealInsituEnv?: boolean;
}): Promise<ConfidenceResponse> {
  const res = await fetch(`${API_BASE}/confidence/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      goal_lon: params.goalLon,
      goal_lat: params.goalLat,
      science_dwell_min: params.scienceDwellMin ?? 45.0,
      has_real_insitu_env: params.hasRealInsituEnv ?? true
    })
  });
  if (!res.ok) throw new Error('Confidence evaluation failed');
  return res.json();
}

export async function runMonteCarlo(params: {
  startLon: number;
  startLat: number;
  goalLon: number;
  goalLat: number;
  numSimulations?: number;
  scienceDwellMin?: number;
}): Promise<MonteCarloResponse> {
  const res = await fetch(`${API_BASE}/confidence/monte-carlo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      goal_lon: params.goalLon,
      goal_lat: params.goalLat,
      num_simulations: params.numSimulations ?? 100,
      science_dwell_min: params.scienceDwellMin ?? 45.0
    })
  });
  if (!res.ok) throw new Error('Monte Carlo simulation failed');
  return res.json();
}

export async function fetchSensitivity(
  startLon: number,
  startLat: number,
  goalLon: number,
  goalLat: number
): Promise<SensitivityResponse> {
  const res = await fetch(
    `${API_BASE}/confidence/sensitivity?start_lon=${startLon}&start_lat=${startLat}&goal_lon=${goalLon}&goal_lat=${goalLat}`
  );
  if (!res.ok) throw new Error('Failed to fetch sensitivity analysis');
  return res.json();
}

export async function discoverScienceTargets(
  currentLon: number,
  currentLat: number,
  radiusM: number = 12000.0
): Promise<DiscoveredTarget[]> {
  const res = await fetch(
    `${API_BASE}/science/discover?current_lon=${currentLon}&current_lat=${currentLat}&radius_m=${radiusM}`
  );
  if (!res.ok) throw new Error('Failed to discover science targets');
  return res.json();
}

export async function optimizeScienceTour(params: {
  startLon: number;
  startLat: number;
  timeBudgetH?: number;
  dwellPerStopMin?: number;
}): Promise<ScienceTourResponse> {
  const res = await fetch(`${API_BASE}/science/tour`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_lon: params.startLon,
      start_lat: params.startLat,
      time_budget_h: params.timeBudgetH ?? 4.0,
      dwell_per_stop_min: params.dwellPerStopMin ?? 30.0
    })
  });
  if (!res.ok) throw new Error('Science tour optimization failed');
  return res.json();
}

export async function fetchHabitatCandidates(): Promise<HabitatCandidate[]> {
  const res = await fetch(`${API_BASE}/habitat/candidates`);
  if (!res.ok) throw new Error('Failed to fetch habitat candidates');
  return res.json();
}

export async function fetchNasaWeather(): Promise<NasaWeatherResponse> {
  const res = await fetch(`${API_BASE}/nasa/weather`);
  if (!res.ok) throw new Error('Failed to fetch NASA InSight weather');
  return res.json();
}

export async function searchNasaMedia(query: string = 'jezero crater', limit: number = 10): Promise<NasaMediaItem[]> {
  const res = await fetch(`${API_BASE}/nasa/media?query=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to search NASA media');
  return res.json();
}
