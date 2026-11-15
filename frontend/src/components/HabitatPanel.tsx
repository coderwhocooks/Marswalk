import React, { useState, useEffect } from 'react';
import { HabitatCandidate } from '../types';
import { Home, Compass, CheckCircle2, AlertCircle, ArrowUpRight, Award, RefreshCw } from 'lucide-react';
import { fetchHabitatCandidates } from '../services/api';

interface HabitatPanelProps {
  onSelectBase: (lon: number, lat: number, name: string) => void;
  currentBaseName?: string;
}

export const HabitatPanel: React.FC<HabitatPanelProps> = ({ onSelectBase, currentBaseName }) => {
  const [candidates, setCandidates] = useState<HabitatCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await fetchHabitatCandidates();
      setCandidates(data);
      if (data.length > 0 && !selectedSiteId) {
        setSelectedSiteId(data[0].site_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCandidates();
  }, []);

  if (loading || candidates.length === 0) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-mars-accent" />
        Running Multi-Criteria Decision Analysis (MCDA) for planetary base siting...
      </div>
    );
  }

  const selectedCandidate = candidates.find((c) => c.site_id === selectedSiteId) || candidates[0];

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-sky-400" />
          <h3 className="font-bold text-white tracking-wide">Habitat & Exploration Base Selection</h3>
        </div>
        <span className="text-[10px] text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded font-mono">
          MCDA / AHP
        </span>
      </div>

      {/* Candidate Selector List */}
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
        {candidates.map((cand, idx) => {
          const isSelected = cand.site_id === selectedSiteId;
          const isCurrentBase = currentBaseName === cand.name;
          return (
            <div
              key={cand.site_id}
              onClick={() => setSelectedSiteId(cand.site_id)}
              className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                isSelected
                  ? 'bg-mars-dark/80 border-mars-accent shadow'
                  : 'bg-mars-dark/40 border-mars-border hover:bg-mars-dark/60'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                  <span>#{idx + 1} {cand.name}</span>
                  {isCurrentBase && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 rounded">
                      ACTIVE BASE
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-mars-subtle font-mono">
                  {cand.lon.toFixed(3)}°E, {cand.lat.toFixed(3)}°N • Elev: {cand.elevation_m}m • Slope: {cand.slope_deg}°
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="font-mono font-bold text-mars-accent text-xs">{cand.composite_suitability}%</div>
                  <div className="text-[9px] text-emerald-400 font-semibold">{cand.classification}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Candidate Detailed Evaluation */}
      {selectedCandidate && (
        <div className="bg-mars-dark/50 border border-mars-border p-3 rounded-lg flex flex-col gap-2.5">
          <div className="flex items-center justify-between border-b border-mars-border/60 pb-2">
            <div>
              <div className="font-bold text-white text-xs">{selectedCandidate.name}</div>
              <div className="text-[10px] text-sky-400 font-mono">{selectedCandidate.operational_capacity}</div>
            </div>
            <button
              onClick={() => onSelectBase(selectedCandidate.lon, selectedCandidate.lat, selectedCandidate.name)}
              className="px-2.5 py-1 bg-mars-accent text-black font-bold text-[10px] rounded hover:bg-sky-400 transition flex items-center gap-1"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Set as Base
            </button>
          </div>

          {/* Siting Criteria Breakdown */}
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="bg-mars-panel/50 p-1.5 rounded flex justify-between">
              <span className="text-mars-subtle">Slope & Flatness:</span>
              <span className="font-mono font-bold text-white">{selectedCandidate.criteria_scores.slope_flatness}%</span>
            </div>
            <div className="bg-mars-panel/50 p-1.5 rounded flex justify-between">
              <span className="text-mars-subtle">Surface Smoothness:</span>
              <span className="font-mono font-bold text-white">{selectedCandidate.criteria_scores.surface_smoothness}%</span>
            </div>
            <div className="bg-mars-panel/50 p-1.5 rounded flex justify-between">
              <span className="text-mars-subtle">Science Reachability:</span>
              <span className="font-mono font-bold text-white">{selectedCandidate.criteria_scores.science_reachability}%</span>
            </div>
            <div className="bg-mars-panel/50 p-1.5 rounded flex justify-between">
              <span className="text-mars-subtle">Egress Corridors:</span>
              <span className="font-mono font-bold text-white">{selectedCandidate.criteria_scores.traverse_egress}%</span>
            </div>
          </div>

          {/* Pros & Cons */}
          <div className="flex flex-col gap-1 text-[10px]">
            {selectedCandidate.pros.map((p, i) => (
              <div key={i} className="text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                <span>{p}</span>
              </div>
            ))}
            {selectedCandidate.cons.map((c, i) => (
              <div key={i} className="text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
