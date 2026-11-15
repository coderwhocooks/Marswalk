import React, { useState, useEffect } from 'react';
import { ScienceTarget, DiscoveredTarget, ScienceTourResponse } from '../types';
import { Sparkles, MapPin, Search, ChevronRight, Award, Compass, Zap, Image, RefreshCw } from 'lucide-react';
import { discoverScienceTargets, optimizeScienceTour, searchNasaMedia } from '../services/api';

interface ScienceTargetPanelProps {
  targets: ScienceTarget[];
  selectedTargetId?: string;
  startCoords?: [number, number];
  onSelectTarget: (target: ScienceTarget) => void;
  onSelectDiscoveredTarget?: (target: DiscoveredTarget) => void;
}

export const ScienceTargetPanel: React.FC<ScienceTargetPanelProps> = ({
  targets,
  selectedTargetId,
  startCoords = [77.4508, 18.4447],
  onSelectTarget,
  onSelectDiscoveredTarget
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mode, setMode] = useState<'catalog' | 'discovery' | 'tour'>('catalog');
  const [activeFilter, setActiveFilter] = useState<'all' | 'high_priority'>('all');

  const [discovered, setDiscovered] = useState<DiscoveredTarget[]>([]);
  const [tour, setTour] = useState<ScienceTourResponse | null>(null);
  const [nasaImages, setNasaImages] = useState<any[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState<boolean>(false);
  const [loadingTour, setLoadingTour] = useState<boolean>(false);

  useEffect(() => {
    if (mode === 'discovery' && discovered.length === 0) {
      setLoadingDiscovery(true);
      discoverScienceTargets(startCoords[0], startCoords[1], 12000)
        .then(setDiscovered)
        .finally(() => setLoadingDiscovery(false));

      searchNasaMedia('jezero crater perseverance', 4)
        .then(setNasaImages)
        .catch(console.error);
    }
  }, [mode, startCoords]);

  const handleGenerateTour = async () => {
    setLoadingTour(true);
    try {
      const res = await optimizeScienceTour({
        startLon: startCoords[0],
        startLat: startCoords[1],
        timeBudgetH: 4.0,
        dwellPerStopMin: 30.0
      });
      setTour(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTour(false);
    }
  };

  const filtered = targets.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.mineralogy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.geological_unit.toLowerCase().includes(searchTerm.toLowerCase());

    if (activeFilter === 'high_priority') {
      return matchesSearch && t.scientific_relevance >= 9.0;
    }
    return matchesSearch;
  });

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 max-h-[580px]">
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold text-white tracking-wide">Scientific Target Intelligence</h3>
        </div>
        <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded font-mono">
          USGS SIM 3464
        </span>
      </div>

      {/* Mode Tabs: Catalog vs Autonomous Discovery vs Science Tour */}
      <div className="flex bg-mars-dark/60 p-0.5 rounded-lg border border-mars-border text-[10px] font-medium">
        <button
          onClick={() => setMode('catalog')}
          className={`flex-1 py-1 rounded transition ${
            mode === 'catalog' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-mars-subtle hover:text-white'
          }`}
        >
          Catalog ({targets.length})
        </button>
        <button
          onClick={() => setMode('discovery')}
          className={`flex-1 py-1 rounded transition ${
            mode === 'discovery' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-mars-subtle hover:text-white'
          }`}
        >
          Autonomous Discovery
        </button>
        <button
          onClick={() => setMode('tour')}
          className={`flex-1 py-1 rounded transition ${
            mode === 'tour' ? 'bg-purple-500/30 text-purple-200 font-bold' : 'text-mars-subtle hover:text-white'
          }`}
        >
          Tour Optimizer
        </button>
      </div>

      {mode === 'catalog' && (
        <>
          {/* Filter Tabs & Search */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 bg-mars-dark/60 border border-mars-border px-2.5 py-1.5 rounded-lg text-xs">
              <Search className="w-3.5 h-3.5 text-mars-subtle" />
              <input
                type="text"
                placeholder="Filter by mineral, formation, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-white placeholder-mars-subtle text-xs w-full"
              />
            </div>

            <div className="flex gap-2 text-[10px]">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2 py-1 rounded transition ${
                  activeFilter === 'all'
                    ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                    : 'text-mars-subtle hover:text-white'
                }`}
              >
                All Targets ({targets.length})
              </button>
              <button
                onClick={() => setActiveFilter('high_priority')}
                className={`px-2 py-1 rounded transition ${
                  activeFilter === 'high_priority'
                    ? 'bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40'
                    : 'text-mars-subtle hover:text-white'
                }`}
              >
                High Biosignature (≥9.0)
              </button>
            </div>
          </div>

          {/* Target Cards List */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {filtered.map((target) => {
              const isSelected = target.target_id === selectedTargetId;
              return (
                <div
                  key={target.target_id}
                  onClick={() => onSelectTarget(target)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-500 text-white shadow-md'
                      : 'bg-mars-dark/40 border-mars-border/80 text-slate-300 hover:border-mars-subtle hover:bg-mars-dark/70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] text-purple-400 font-mono font-semibold uppercase flex items-center gap-1">
                        <span>{target.target_id}</span>
                        <span>•</span>
                        <span>{target.unit_symbol}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white">{target.name}</h4>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono font-bold">
                      <Award className="w-3 h-3 text-purple-400" />
                      {target.scientific_relevance.toFixed(1)}
                    </div>
                  </div>

                  <div className="text-[11px] text-mars-subtle">
                    <strong className="text-slate-300">Unit:</strong> {target.geological_unit}
                  </div>

                  <div className="text-[11px] text-mars-subtle truncate">
                    <strong className="text-slate-300">Minerals:</strong> {target.mineralogy}
                  </div>

                  <div className="text-[10px] text-slate-400 bg-mars-panel/60 p-1.5 rounded border border-mars-border/40 mt-0.5 line-clamp-2">
                    🎯 {target.investigation_objective}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-mars-subtle pt-1 border-t border-mars-border/40 mt-1">
                    <span>{target.supporting_instrument}</span>
                    <span className="text-purple-300 font-medium flex items-center gap-0.5">
                      Plan Route <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === 'discovery' && (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 text-xs">
          {loadingDiscovery ? (
            <div className="text-center py-6 text-mars-subtle flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
              Scanning geological formations for high-density science...
            </div>
          ) : (
            <>
              <div className="text-[10px] text-mars-subtle font-mono mb-1">
                Autonomously ranked by Scientific Value Density (SVD = Value / Distance Impedance).
              </div>
              {discovered.map((t) => (
                <div
                  key={t.target_id}
                  onClick={() => {
                    const matched = targets.find((orig) => orig.target_id === t.target_id);
                    if (matched) onSelectTarget(matched);
                  }}
                  className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1 cursor-pointer hover:border-purple-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{t.name}</span>
                    <span className="font-mono text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      SVD: {t.scientific_value_density}
                    </span>
                  </div>
                  <div className="text-[10px] text-mars-subtle">
                    {t.geological_unit} • {t.distance_m}m from base
                  </div>
                  <div className="text-[10px] text-slate-300 bg-mars-panel/40 p-1.5 rounded">
                    {t.evidence_summary}
                  </div>
                </div>
              ))}

              {/* NASA Media Preview */}
              {nasaImages.length > 0 && (
                <div className="mt-2 pt-2 border-t border-mars-border/60 flex flex-col gap-1.5">
                  <div className="text-[10px] uppercase font-bold text-mars-subtle flex items-center gap-1.5">
                    <Image className="w-3 h-3 text-purple-400" />
                    NASA Mission Media Archive
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {nasaImages.map((img, i) => (
                      <div key={i} className="bg-mars-dark/60 border border-mars-border p-1 rounded flex flex-col gap-1">
                        <img src={img.thumb_url} alt={img.title} className="w-full h-16 object-cover rounded" />
                        <div className="text-[9px] text-white truncate font-medium">{img.title}</div>
                        <div className="text-[8px] text-mars-subtle font-mono">{img.nasa_id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'tour' && (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1 text-xs">
          <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-xs">Multi-Stop Prize Optimizer</div>
                <div className="text-[10px] text-mars-subtle font-mono">Bounded Orienteering (4.0h EVA Budget)</div>
              </div>
              <button
                onClick={handleGenerateTour}
                disabled={loadingTour}
                className="px-2.5 py-1 bg-purple-500 text-white font-bold text-[10px] rounded hover:bg-purple-600 transition flex items-center gap-1"
              >
                {loadingTour ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Generate Tour
              </button>
            </div>
          </div>

          {tour && (
            <div className="bg-mars-dark/50 border border-mars-border p-3 rounded-lg flex flex-col gap-2">
              <div className="grid grid-cols-3 gap-1.5 text-center bg-mars-panel/50 p-2 rounded text-[10px]">
                <div>
                  <div className="text-mars-subtle">Total Dist</div>
                  <div className="font-mono font-bold text-white">{tour.total_distance_km} km</div>
                </div>
                <div>
                  <div className="text-mars-subtle">Duration</div>
                  <div className="font-mono font-bold text-white">{tour.total_duration_h} h</div>
                </div>
                <div>
                  <div className="text-mars-subtle">Science Yield</div>
                  <div className="font-mono font-bold text-purple-300">{tour.total_science_value} pts</div>
                </div>
              </div>

              <div className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                ✓ Guaranteed safe return within 4.0h life-support limit
              </div>

              <div className="flex flex-col gap-1.5 mt-1">
                {tour.stops.map((stop) => (
                  <div key={stop.stop_number} className="bg-mars-panel/40 border border-mars-border/40 p-2 rounded flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold flex items-center justify-center text-[10px]">
                        {stop.stop_number}
                      </span>
                      <div>
                        <div className="font-bold text-white">{stop.name}</div>
                        <div className="text-[9px] text-mars-subtle font-mono">
                          Arrival: {stop.arrival_time_min} min • Dwell: {stop.dwell_time_min} min
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-purple-300">
                      +{stop.science_value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
