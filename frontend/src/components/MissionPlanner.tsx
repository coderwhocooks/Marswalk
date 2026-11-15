import React from 'react';
import { ScienceTarget } from '../types';
import { Compass, Shield, Zap, Sliders, MapPin, Navigation } from 'lucide-react';
import { LocationHoverWrapper } from './LocationDetailTooltip';

interface MissionPlannerProps {
  startCoords: [number, number];
  targetCoords: [number, number];
  startName: string;
  targetName: string;
  scienceTargets: ScienceTarget[];
  selectedMode: string;
  maxSlopeDeg: number;
  clickMode: 'start' | 'target' | 'inspect';
  isCalculating: boolean;
  onSelectMode: (mode: string) => void;
  onSelectMaxSlope: (deg: number) => void;
  onSetClickMode: (mode: 'start' | 'target' | 'inspect') => void;
  onSelectTargetPreset: (target: ScienceTarget) => void;
  onPlanRoute: () => void;
  onCompareRoutes: () => void;
}

export const MissionPlanner: React.FC<MissionPlannerProps> = ({
  startCoords,
  targetCoords,
  startName,
  targetName,
  scienceTargets,
  selectedMode,
  maxSlopeDeg,
  clickMode,
  isCalculating,
  onSelectMode,
  onSelectMaxSlope,
  onSetClickMode,
  onSelectTargetPreset,
  onPlanRoute,
  onCompareRoutes
}) => {
  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-mars-border pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-mars-red" />
          <h2 className="text-sm font-bold text-white tracking-wide">Traverse Mission Planner</h2>
        </div>
        <span className="text-[11px] bg-mars-red/20 text-mars-red px-2 py-0.5 rounded font-mono font-medium">
          A* SOL-OPTIMIZER
        </span>
      </div>

      {/* Waypoint Selectors */}
      <div className="flex flex-col gap-2.5">
        {/* Staging Point */}
        <LocationHoverWrapper
          info={{
            name: startName,
            category: 'EVA Staging Base',
            lon: startCoords[0],
            lat: startCoords[1],
            elevation_m: -2567.2,
            badge: 'STAGING BASE',
            description: 'Designated staging base and primary EVA egress origin in Jezero Crater. Astronauts deploy and return to this facility.',
            actionHint: 'Click Pick to choose a different staging site on the 3D map'
          }}
          className="w-full"
        >
          <div className="flex items-center justify-between bg-mars-dark/60 border border-mars-border p-2.5 rounded-lg text-xs hover:border-mars-subtle transition">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <div>
                <div className="text-[10px] uppercase text-mars-subtle font-semibold">Staging Site</div>
                <div className="text-white font-medium truncate max-w-[170px]">{startName}</div>
                <div className="text-[10px] text-mars-subtle font-mono">{startCoords[1].toFixed(4)}°N, {startCoords[0].toFixed(4)}°E</div>
              </div>
            </div>
            <button
              onClick={() => onSetClickMode('start')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                clickMode === 'start'
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-mars-border hover:bg-mars-border/80 text-white'
              }`}
            >
              <MapPin className="w-3 h-3 inline mr-1" />
              {clickMode === 'start' ? 'Click Map...' : 'Pick'}
            </button>
          </div>
        </LocationHoverWrapper>

        {/* Destination Target */}
        <LocationHoverWrapper
          info={{
            name: targetName,
            category: 'Exploration Waypoint',
            lon: targetCoords[0],
            lat: targetCoords[1],
            elevation_m: -2548.0,
            badge: 'DESTINATION',
            description: 'Primary exploration destination targeted for scientific sampling, field observation, or traverse traversal.',
            actionHint: 'Click Pick to select a custom destination on the 3D map'
          }}
          className="w-full"
        >
          <div className="flex items-center justify-between bg-mars-dark/60 border border-mars-border p-2.5 rounded-lg text-xs hover:border-mars-subtle transition">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <div>
                <div className="text-[10px] uppercase text-mars-subtle font-semibold">Exploration Target</div>
                <div className="text-white font-medium truncate max-w-[170px]">{targetName}</div>
                <div className="text-[10px] text-mars-subtle font-mono">{targetCoords[1].toFixed(4)}°N, {targetCoords[0].toFixed(4)}°E</div>
              </div>
            </div>
            <button
              onClick={() => onSetClickMode('target')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${
                clickMode === 'target'
                  ? 'bg-rose-500 text-white font-semibold'
                  : 'bg-mars-border hover:bg-mars-border/80 text-white'
              }`}
            >
              <Navigation className="w-3 h-3 inline mr-1" />
              {clickMode === 'target' ? 'Click Map...' : 'Pick'}
            </button>
          </div>
        </LocationHoverWrapper>
      </div>

      {/* Target Presets Quick Bar */}
      <div>
        <label className="text-[11px] text-mars-subtle block mb-1 font-medium">Quick Target Presets (Hover for Details):</label>
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          {scienceTargets.slice(1, 5).map((t) => (
            <LocationHoverWrapper
              key={t.target_id}
              info={{
                name: t.name,
                category: 'Science Target',
                lon: t.lon,
                lat: t.lat,
                score: t.composite_score || t.scientific_relevance * 10,
                scoreLabel: 'Science Priority',
                geologicalUnit: t.geological_unit,
                mineralogy: t.mineralogy,
                badge: t.target_id,
                description: t.description || t.investigation_objective,
                keyFacts: [
                  { label: 'Unit Symbol', value: t.unit_symbol },
                  { label: 'Instrument', value: t.supporting_instrument }
                ],
                actionHint: 'Click to select this target preset'
              }}
              className="w-full"
            >
              <button
                onClick={() => onSelectTargetPreset(t)}
                className="w-full text-left bg-mars-dark/40 hover:bg-mars-border/50 border border-mars-border/70 px-2 py-1.5 rounded truncate text-mars-subtle hover:text-white transition"
              >
                🎯 {t.name.split(' (')[0]}
              </button>
            </LocationHoverWrapper>
          ))}
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <label className="text-[11px] text-mars-subtle block mb-1 font-medium">Optimization Strategy:</label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => onSelectMode('safe')}
            className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
              selectedMode === 'safe'
                ? 'bg-sky-500/10 border-mars-accent text-white'
                : 'bg-mars-dark/40 border-mars-border text-mars-subtle hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-mars-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Safe Traverse</div>
              <div className="text-[10px] text-mars-subtle">Penalizes steep slopes & roughness</div>
            </div>
          </button>

          <button
            onClick={() => onSelectMode('shortest')}
            className={`p-2 rounded-lg border text-left flex items-start gap-2 transition ${
              selectedMode === 'shortest'
                ? 'bg-orange-500/10 border-orange-500 text-white'
                : 'bg-mars-dark/40 border-mars-border text-mars-subtle hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-[11px]">Shortest Path</div>
              <div className="text-[10px] text-mars-subtle">Direct geometric distance</div>
            </div>
          </button>
        </div>
      </div>

      {/* Constraints Sliders */}
      <div className="bg-mars-dark/40 border border-mars-border/60 p-3 rounded-lg text-xs flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-mars-subtle">
            <Sliders className="w-3.5 h-3.5" />
            Max Astronaut Slope Limit:
          </span>
          <span className="font-mono font-bold text-mars-accent">{maxSlopeDeg}°</span>
        </div>
        <input
          type="range"
          min="10"
          max="30"
          step="1"
          value={maxSlopeDeg}
          onChange={(e) => onSelectMaxSlope(Number(e.target.value))}
          className="w-full accent-mars-accent cursor-pointer h-1.5 bg-mars-border rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-mars-subtle">
          <span>10° (Conservative)</span>
          <span>20° (NASA EVA Nominal)</span>
          <span>30° (High Risk)</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={onPlanRoute}
          disabled={isCalculating}
          className="bg-mars-red hover:bg-mars-red/90 text-white font-semibold py-2 px-3 rounded-lg text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isCalculating ? (
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <Navigation className="w-3.5 h-3.5" />
          )}
          {isCalculating ? 'Computing...' : 'Calculate Route'}
        </button>

        <button
          onClick={onCompareRoutes}
          disabled={isCalculating}
          className="bg-mars-panel hover:bg-mars-border/80 border border-mars-accent text-mars-accent font-semibold py-2 px-3 rounded-lg text-xs shadow transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          Compare Modes
        </button>
      </div>
    </div>
  );
};
