import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  Activity,
  Clock,
  Database,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Globe2
} from 'lucide-react';
import { MapViewer } from './components/MapViewer';
import { MarsGlobeViewer } from './components/MarsGlobeViewer';
import { ElevationProfile } from './components/ElevationProfile';
import { MissionPlanner } from './components/MissionPlanner';
import { RouteComparison } from './components/RouteComparison';
import { LayerManager } from './components/LayerManager';
import { ScienceTargetPanel } from './components/ScienceTargetPanel';
import { EnvironmentalPanel } from './components/EnvironmentalPanel';
import { SimulationGauge } from './components/SimulationGauge';
import { BriefingModal } from './components/BriefingModal';

import {
  ScienceTarget,
  RoutePlanResponse,
  RouteCompareResponse,
  MissionSimulateResponse,
  EnvironmentalConditions,
  DatasetMetadata,
  TerrainMesh3DResponse
} from './types';

import {
  fetchScienceTargets,
  fetchEnvironment,
  fetchDatasets,
  planRoute,
  compareRoutes,
  simulateMission,
  generateReport,
  fetchTerrainMesh3D
} from './services/api';

export function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'planner' | 'science' | 'environment' | 'simulation' | 'datasets'>('planner');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Staging & Target Waypoints (Defaults to Octavia Butler Landing -> Hawksbill Gap)
  const [startCoords, setStartCoords] = useState<[number, number]>([77.4508, 18.4447]);
  const [startName, setStartName] = useState<string>('Octavia E. Butler Base');
  const [targetCoords, setTargetCoords] = useState<[number, number]>([77.4060, 18.4350]);
  const [targetName, setTargetName] = useState<string>('Hawksbill Gap (Delta Scarp)');
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>('JEZ-SCI-02');

  // Map & Interaction State
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [clickMode, setClickMode] = useState<'start' | 'target' | 'inspect'>('target');
  const [activeBaseLayer, setActiveBaseLayer] = useState<string>('ctx');
  const [showSlopeOverlay, setShowSlopeOverlay] = useState<boolean>(true);
  const [showScienceMarkers, setShowScienceMarkers] = useState<boolean>(true);

  // Planner Parameters
  const [selectedMode, setSelectedMode] = useState<string>('safe');
  const [maxSlopeDeg, setMaxSlopeDeg] = useState<number>(20.0);
  const [scienceDurationMin, setScienceDurationMin] = useState<number>(45);
  const [lmstHour, setLmstHour] = useState<number>(12.0);

  // Calculation Results
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [routePlan, setRoutePlan] = useState<RoutePlanResponse | undefined>(undefined);
  const [altRoutePlan, setAltRoutePlan] = useState<RoutePlanResponse | undefined>(undefined);
  const [comparison, setComparison] = useState<RouteCompareResponse | undefined>(undefined);
  const [simulation, setSimulation] = useState<MissionSimulateResponse | undefined>(undefined);
  const [environment, setEnvironment] = useState<EnvironmentalConditions | undefined>(undefined);
  const [scienceTargets, setScienceTargets] = useState<ScienceTarget[]>([]);
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [meshData, setMeshData] = useState<TerrainMesh3DResponse | undefined>(undefined);

  // Briefing Modal
  const [isBriefingOpen, setIsBriefingOpen] = useState<boolean>(false);
  const [briefingData, setBriefingData] = useState<any>(null);
  const [markdownReport, setMarkdownReport] = useState<string>('');

  // Initial Data Fetch
  useEffect(() => {
    async function init() {
      try {
        const [targets, envData, dsList, mesh] = await Promise.all([
          fetchScienceTargets(startCoords[0], startCoords[1]),
          fetchEnvironment(lmstHour, 4.0),
          fetchDatasets(),
          fetchTerrainMesh3D(10)
        ]);
        setScienceTargets(targets);
        setEnvironment(envData);
        setDatasets(dsList);
        setMeshData(mesh);

        // Auto-run initial baseline route
        handlePlanRoute();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // Update environmental telemetry when LMST changes
  useEffect(() => {
    async function updateEnv() {
      try {
        const envData = await fetchEnvironment(lmstHour, simulation?.total_mission_time_h || 4.0);
        setEnvironment(envData);
      } catch (err) {
        console.error('Failed to update environment:', err);
      }
    }
    updateEnv();
  }, [lmstHour]);

  // Route Planning Execution
  const handlePlanRoute = async () => {
    setIsCalculating(true);
    try {
      const plan = await planRoute({
        startLon: startCoords[0],
        startLat: startCoords[1],
        goalLon: targetCoords[0],
        goalLat: targetCoords[1],
        mode: selectedMode,
        maxSlopeDeg: maxSlopeDeg
      });
      setRoutePlan(plan);
      setAltRoutePlan(undefined);
      setComparison(undefined);

      // Run simulation on calculated route
      const sim = await simulateMission({
        distanceM: plan.total_distance_m,
        walkingTimeS: plan.estimated_duration_s,
        scienceDurationMin: scienceDurationMin
      });
      setSimulation(sim);
    } catch (err: any) {
      alert(`Route calculation error: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  // Compare Routes Execution
  const handleCompareRoutes = async () => {
    setIsCalculating(true);
    try {
      const comp = await compareRoutes({
        startLon: startCoords[0],
        startLat: startCoords[1],
        goalLon: targetCoords[0],
        goalLat: targetCoords[1],
        maxSlopeDeg: maxSlopeDeg
      });
      setComparison(comp);

      if (comp.routes['safe']) {
        setRoutePlan(comp.routes['safe']);
      }
      if (comp.routes['shortest']) {
        setAltRoutePlan(comp.routes['shortest']);
      }

      // Simulate the safe route
      const primary = comp.routes['safe'] || comp.routes['shortest'];
      if (primary) {
        const sim = await simulateMission({
          distanceM: primary.total_distance_m,
          walkingTimeS: primary.estimated_duration_s,
          scienceDurationMin: scienceDurationMin
        });
        setSimulation(sim);
      }
    } catch (err: any) {
      alert(`Route comparison error: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle Map Clicks
  const handleMapClick = (lon: number, lat: number) => {
    if (clickMode === 'start') {
      setStartCoords([lon, lat]);
      setStartName(`Staging (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`);
      setClickMode('inspect');
    } else if (clickMode === 'target') {
      setTargetCoords([lon, lat]);
      setTargetName(`Target (${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E)`);
      setSelectedTargetId(undefined);
      setClickMode('inspect');
    }
  };

  // Select Science Target Preset
  const handleSelectScienceTarget = (target: ScienceTarget) => {
    setTargetCoords([target.lon, target.lat]);
    setTargetName(target.name);
    setSelectedTargetId(target.target_id);
    setActiveTab('planner');
  };

  // Generate Mission Briefing
  const handleGenerateReport = async () => {
    if (!routePlan || !simulation || !environment) {
      alert('Please calculate a route and simulation first.');
      return;
    }

    try {
      const rep = await generateReport({
        missionId: 'EVA-JEZ-2026-ALPHA',
        crewNames: ['Cmdr. Maya Thorne', 'Dr. Eric Vasquez'],
        startName: startName,
        startCoords: startCoords,
        targetId: selectedTargetId,
        targetName: targetName,
        routePlan: routePlan,
        simulation: simulation,
        environment: environment
      });
      setBriefingData(rep.briefing_data);
      setMarkdownReport(rep.markdown_report);
      setIsBriefingOpen(true);
    } catch (err: any) {
      alert(`Failed to generate briefing: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-mars-dark text-mars-text">
      {/* Top Mission Control App Bar */}
      <header className="h-14 border-b border-mars-border bg-mars-panel px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-mars-red flex items-center justify-center font-black text-white text-lg tracking-wider shadow-md">
            M
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-white text-sm tracking-wider uppercase">
                MARSWALK
              </h1>
              <span className="text-[10px] bg-mars-red/20 text-mars-red px-2 py-0.5 rounded font-mono font-bold">
                NASA SPACE APPS 2026
              </span>
            </div>
            <div className="text-[11px] text-mars-subtle font-mono flex items-center gap-2">
              <span>Martian Astronaut Route & Scientific Exploration Planner</span>
              <span>•</span>
              <span className="text-slate-300">Jezero Crater (18.4°N, 77.4°E)</span>
            </div>
          </div>
        </div>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-3">
          {/* 2D / 3D Mode Toggle */}
          <div className="flex items-center bg-mars-dark/80 border border-mars-border p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
                viewMode === '3d'
                  ? 'bg-mars-accent text-black font-bold shadow'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              3D Mars Globe
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 rounded-md flex items-center gap-1.5 transition ${
                viewMode === '2d'
                  ? 'bg-mars-accent text-black font-bold shadow'
                  : 'text-mars-subtle hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2D Tactical GIS
            </button>
          </div>

          <div className="flex items-center gap-2 bg-mars-dark/60 border border-mars-border px-3 py-1.5 rounded-lg text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-mars-subtle">USGS 20m DTM:</span>
            <span className="text-white font-semibold">2.41M pts</span>
            <span className="text-mars-subtle">|</span>
            <span className="text-mars-subtle">LMST:</span>
            <span className="text-mars-accent font-semibold">{Math.floor(lmstHour)}:00 SOL</span>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={!routePlan}
            className="bg-mars-red hover:bg-mars-red/90 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-md transition disabled:opacity-40 flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Expedition Briefing
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <aside
          className={`border-r border-mars-border bg-mars-panel/95 backdrop-blur shrink-0 transition-all duration-300 flex flex-col z-20 ${
            sidebarCollapsed ? 'w-14' : 'w-96'
          }`}
        >
          {sidebarCollapsed ? (
            /* Collapsed Vertical Icon Bar */
            <div className="flex flex-col items-center py-2.5 h-full gap-2 shrink-0">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2.5 text-mars-subtle hover:text-white hover:bg-mars-dark/60 rounded-lg transition"
                title="Expand Panel"
                aria-label="Expand Panel"
              >
                <ChevronRight className="w-4 h-4 text-mars-accent" />
              </button>

              <div className="w-8 border-b border-mars-border/60 my-1" />

              <button
                onClick={() => {
                  setActiveTab('planner');
                  setSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-lg transition ${
                  activeTab === 'planner'
                    ? 'text-white bg-mars-red/30 border border-mars-red'
                    : 'text-mars-subtle hover:text-white hover:bg-mars-dark/60'
                }`}
                title="Traverse Planner"
                aria-label="Traverse Planner"
              >
                <Compass className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('science');
                  setSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-lg transition ${
                  activeTab === 'science'
                    ? 'text-purple-300 bg-purple-500/30 border border-purple-500'
                    : 'text-mars-subtle hover:text-white hover:bg-mars-dark/60'
                }`}
                title="Science Targets"
                aria-label="Science Targets"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('environment');
                  setSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-lg transition ${
                  activeTab === 'environment'
                    ? 'text-emerald-300 bg-emerald-500/30 border border-emerald-500'
                    : 'text-mars-subtle hover:text-white hover:bg-mars-dark/60'
                }`}
                title="MEDA Environment"
                aria-label="MEDA Environment"
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('simulation');
                  setSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-lg transition ${
                  activeTab === 'simulation'
                    ? 'text-sky-300 bg-sky-500/30 border border-sky-500'
                    : 'text-mars-subtle hover:text-white hover:bg-mars-dark/60'
                }`}
                title="Life Support"
                aria-label="Life Support"
              >
                <Clock className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setActiveTab('datasets');
                  setSidebarCollapsed(false);
                }}
                className={`p-2.5 rounded-lg transition ${
                  activeTab === 'datasets'
                    ? 'text-white bg-slate-500/30 border border-slate-400'
                    : 'text-mars-subtle hover:text-white hover:bg-mars-dark/60'
                }`}
                title="Datasets"
                aria-label="Datasets"
              >
                <Database className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Tab Selector Bar */}
              <div className="flex items-center border-b border-mars-border bg-mars-dark/40 overflow-x-auto text-xs shrink-0">
                <button
                  onClick={() => setActiveTab('planner')}
                  className={`p-2.5 flex-1 flex flex-col items-center justify-center gap-1 transition ${
                    activeTab === 'planner'
                      ? 'border-b-2 border-mars-red text-white font-semibold bg-mars-panel/60'
                      : 'text-mars-subtle hover:text-white'
                  }`}
                  title="Traverse Planner"
                >
                  <Compass className="w-4 h-4" />
                  <span className="text-[10px]">Planner</span>
                </button>

                <button
                  onClick={() => setActiveTab('science')}
                  className={`p-2.5 flex-1 flex flex-col items-center justify-center gap-1 transition ${
                    activeTab === 'science'
                      ? 'border-b-2 border-purple-500 text-purple-300 font-semibold bg-mars-panel/60'
                      : 'text-mars-subtle hover:text-white'
                  }`}
                  title="Science Targets"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px]">Science</span>
                </button>

                <button
                  onClick={() => setActiveTab('environment')}
                  className={`p-2.5 flex-1 flex flex-col items-center justify-center gap-1 transition ${
                    activeTab === 'environment'
                      ? 'border-b-2 border-emerald-500 text-emerald-300 font-semibold bg-mars-panel/60'
                      : 'text-mars-subtle hover:text-white'
                  }`}
                  title="MEDA Environment"
                >
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px]">MEDA</span>
                </button>

                <button
                  onClick={() => setActiveTab('simulation')}
                  className={`p-2.5 flex-1 flex flex-col items-center justify-center gap-1 transition ${
                    activeTab === 'simulation'
                      ? 'border-b-2 border-mars-accent text-sky-300 font-semibold bg-mars-panel/60'
                      : 'text-mars-subtle hover:text-white'
                  }`}
                  title="Life Support"
                >
                  <Clock className="w-4 h-4" />
                  <span className="text-[10px]">Support</span>
                </button>

                <button
                  onClick={() => setActiveTab('datasets')}
                  className={`p-2.5 flex-1 flex flex-col items-center justify-center gap-1 transition ${
                    activeTab === 'datasets'
                      ? 'border-b-2 border-slate-400 text-white font-semibold bg-mars-panel/60'
                      : 'text-mars-subtle hover:text-white'
                  }`}
                  title="Datasets"
                >
                  <Database className="w-4 h-4" />
                  <span className="text-[10px]">Data</span>
                </button>

                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-2 text-mars-subtle hover:text-white"
                  title="Collapse Panel"
                  aria-label="Collapse Panel"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Body */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              {activeTab === 'planner' && (
                <>
                  <MissionPlanner
                    startCoords={startCoords}
                    targetCoords={targetCoords}
                    startName={startName}
                    targetName={targetName}
                    scienceTargets={scienceTargets}
                    selectedMode={selectedMode}
                    maxSlopeDeg={maxSlopeDeg}
                    clickMode={clickMode}
                    isCalculating={isCalculating}
                    onSelectMode={setSelectedMode}
                    onSelectMaxSlope={setMaxSlopeDeg}
                    onSetClickMode={setClickMode}
                    onSelectTargetPreset={handleSelectScienceTarget}
                    onPlanRoute={handlePlanRoute}
                    onCompareRoutes={handleCompareRoutes}
                  />

                  {comparison && <RouteComparison comparison={comparison} />}

                  <LayerManager
                    activeBaseLayer={activeBaseLayer}
                    showSlopeOverlay={showSlopeOverlay}
                    showScienceMarkers={showScienceMarkers}
                    onSelectBaseLayer={setActiveBaseLayer}
                    onToggleSlopeOverlay={() => setShowSlopeOverlay(!showSlopeOverlay)}
                    onToggleScienceMarkers={() => setShowScienceMarkers(!showScienceMarkers)}
                  />
                </>
              )}

              {activeTab === 'science' && (
                <ScienceTargetPanel
                  targets={scienceTargets}
                  selectedTargetId={selectedTargetId}
                  onSelectTarget={handleSelectScienceTarget}
                />
              )}

              {activeTab === 'environment' && (
                <EnvironmentalPanel
                  conditions={environment}
                  lmstHour={lmstHour}
                  missionDurationHours={simulation?.total_mission_time_h || 4.0}
                  onLmstChange={setLmstHour}
                />
              )}

              {activeTab === 'simulation' && (
                <SimulationGauge
                  simulation={simulation}
                  scienceDurationMin={scienceDurationMin}
                  onScienceDurationChange={(min) => {
                    setScienceDurationMin(min);
                    if (routePlan) {
                      simulateMission({
                        distanceM: routePlan.total_distance_m,
                        walkingTimeS: routePlan.estimated_duration_s,
                        scienceDurationMin: min
                      }).then(setSimulation);
                    }
                  }}
                />
              )}

              {activeTab === 'datasets' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 border-b border-mars-border pb-2">
                    <Database className="w-4 h-4 text-mars-accent" />
                    <h3 className="text-xs font-bold text-white tracking-wide">Planetary Dataset Registry</h3>
                  </div>
                  {datasets.map((ds) => (
                    <div key={ds.dataset_id} className="bg-mars-dark/50 border border-mars-border p-3 rounded-lg flex flex-col gap-1 text-[11px]">
                      <div className="font-bold text-white text-xs">{ds.name}</div>
                      <div className="text-mars-accent font-mono text-[10px]">{ds.dataset_id}</div>
                      <div className="text-mars-subtle">
                        <strong>Mission / Instrument:</strong> {ds.mission} ({ds.instrument})
                      </div>
                      <div className="text-mars-subtle">
                        <strong>Resolution:</strong> {ds.spatial_resolution}
                      </div>
                      <div className="text-mars-subtle">
                        <strong>CRS:</strong> {ds.crs}
                      </div>
                      <div className="text-slate-400 text-[10px] mt-1 bg-mars-panel/60 p-1.5 rounded">
                        {ds.notes}
                      </div>
                      <a
                        href={ds.provenance_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-mars-accent hover:underline mt-1 truncate"
                      >
                        🔗 Source Archive Link
                      </a>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </>
          )}
        </aside>

        {/* Center / Right Stage: 3D Terrain or 2D Map & Elevation Cross Section */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-mars-dark relative">
          {/* Main Planetary Viewport */}
          <div className="flex-1 relative">
            {viewMode === '3d' ? (
              <MarsGlobeViewer
                meshData={meshData}
                routePlan={routePlan}
                startCoords={startCoords}
                targetCoords={targetCoords}
                scienceTargets={showScienceMarkers ? scienceTargets : []}
                selectedTargetId={selectedTargetId}
                environment={environment}
                onSelectTarget={handleSelectScienceTarget}
              />
            ) : (
              <MapViewer
                startCoords={startCoords}
                targetCoords={targetCoords}
                scienceTargets={showScienceMarkers ? scienceTargets : []}
                selectedTargetId={selectedTargetId}
                routePlan={routePlan}
                altRoutePlan={altRoutePlan}
                activeBaseLayer={activeBaseLayer}
                clickMode={clickMode}
                onMapClick={handleMapClick}
                onTargetSelect={handleSelectScienceTarget}
              />
            )}
          </div>

          {/* Bottom Dock: Topographic Cross-Section Profile */}
          <div className="h-44 border-t border-mars-border bg-mars-panel/95 backdrop-blur p-2.5 shrink-0 z-20">
            <ElevationProfile routePlan={routePlan} />
          </div>
        </main>
      </div>

      {/* Expedition Briefing Full Modal */}
      <BriefingModal
        isOpen={isBriefingOpen}
        briefingData={briefingData}
        markdownReport={markdownReport}
        onClose={() => setIsBriefingOpen(false)}
      />
    </div>
  );
}

export default App;
