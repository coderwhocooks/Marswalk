import React from 'react';
import { Layers, Eye, EyeOff } from 'lucide-react';

interface LayerManagerProps {
  activeBaseLayer: string;
  showSlopeOverlay: boolean;
  showScienceMarkers: boolean;
  onSelectBaseLayer: (layerId: string) => void;
  onToggleSlopeOverlay: () => void;
  onToggleScienceMarkers: () => void;
}

export const LayerManager: React.FC<LayerManagerProps> = ({
  activeBaseLayer,
  showSlopeOverlay,
  showScienceMarkers,
  onSelectBaseLayer,
  onToggleSlopeOverlay,
  onToggleScienceMarkers
}) => {
  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-mars-border pb-2">
        <Layers className="w-4 h-4 text-mars-accent" />
        <h3 className="text-xs font-bold text-white tracking-wide">Planetary Map Layers</h3>
      </div>

      {/* Base Layer Switcher */}
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="text-[10px] text-mars-subtle font-semibold uppercase">Base Imagery</span>

        <button
          onClick={() => onSelectBaseLayer('ctx')}
          className={`px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition ${
            activeBaseLayer === 'ctx'
              ? 'bg-mars-red/20 border border-mars-red/50 text-white font-medium'
              : 'bg-mars-dark/40 border border-mars-border text-mars-subtle hover:text-white'
          }`}
        >
          <span>Jezero CTX Orthomosaic (6m/px)</span>
          <span className="text-[10px] text-mars-subtle font-mono">NASA TREK</span>
        </button>

        <button
          onClick={() => onSelectBaseLayer('mola')}
          className={`px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition ${
            activeBaseLayer === 'mola'
              ? 'bg-mars-red/20 border border-mars-red/50 text-white font-medium'
              : 'bg-mars-dark/40 border border-mars-border text-mars-subtle hover:text-white'
          }`}
        >
          <span>MOLA Shaded Relief (463m)</span>
          <span className="text-[10px] text-mars-subtle font-mono">GLOBAL</span>
        </button>

        <button
          onClick={() => onSelectBaseLayer('viking')}
          className={`px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition ${
            activeBaseLayer === 'viking'
              ? 'bg-mars-red/20 border border-mars-red/50 text-white font-medium'
              : 'bg-mars-dark/40 border border-mars-border text-mars-subtle hover:text-white'
          }`}
        >
          <span>Viking MDIM 2.1 Color (232m)</span>
          <span className="text-[10px] text-mars-subtle font-mono">MDIM21</span>
        </button>
      </div>

      {/* Feature Overlays */}
      <div className="flex flex-col gap-1.5 text-xs border-t border-mars-border/50 pt-2">
        <span className="text-[10px] text-mars-subtle font-semibold uppercase">Feature Overlays</span>

        <button
          onClick={onToggleScienceMarkers}
          className="flex items-center justify-between bg-mars-dark/40 border border-mars-border px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white transition"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Science Targets (USGS SIM 3464)
          </span>
          {showScienceMarkers ? <Eye className="w-3.5 h-3.5 text-purple-400" /> : <EyeOff className="w-3.5 h-3.5 text-mars-subtle" />}
        </button>

        <button
          onClick={onToggleSlopeOverlay}
          className="flex items-center justify-between bg-mars-dark/40 border border-mars-border px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white transition"
        >
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Slope Hazard Warning (&gt;15°)
          </span>
          {showSlopeOverlay ? <Eye className="w-3.5 h-3.5 text-rose-400" /> : <EyeOff className="w-3.5 h-3.5 text-mars-subtle" />}
        </button>
      </div>
    </div>
  );
};
