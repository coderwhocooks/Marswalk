import React from 'react';
import { RouteCompareResponse } from '../types';
import { GitCompare, Shield, Zap, CheckCircle2 } from 'lucide-react';

interface RouteComparisonProps {
  comparison?: RouteCompareResponse;
}

export const RouteComparison: React.FC<RouteComparisonProps> = ({ comparison }) => {
  if (!comparison || !comparison.routes) return null;

  const shortest = comparison.routes['shortest'];
  const safe = comparison.routes['safe'];

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-mars-border pb-2.5">
        <GitCompare className="w-4 h-4 text-mars-accent" />
        <h3 className="text-xs font-bold text-white tracking-wide">Multi-Mode Route Trade-Off Analysis</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Safe Route Card */}
        {safe && (
          <div className="bg-sky-500/5 border border-mars-accent/40 rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-mars-accent flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Safe Traverse
              </span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono">
                RECOMMENDED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] mt-1 text-mars-subtle">
              <span>Distance:</span>
              <strong className="text-white">{safe.total_distance_km} km</strong>
              <span>Walk Time:</span>
              <strong className="text-white">{safe.estimated_duration_h} h</strong>
              <span>Avg Slope:</span>
              <strong className="text-emerald-400">{safe.avg_slope_deg}°</strong>
              <span>Max Slope:</span>
              <strong className="text-sky-300">{safe.max_slope_deg}°</strong>
              <span>Hazards:</span>
              <strong className="text-white">{safe.hazard_segments.length}</strong>
            </div>
          </div>
        )}

        {/* Shortest Route Card */}
        {shortest && (
          <div className="bg-orange-500/5 border border-orange-500/40 rounded-lg p-3 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-orange-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Shortest Distance
              </span>
              <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-mono">
                DIRECT
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] mt-1 text-mars-subtle">
              <span>Distance:</span>
              <strong className="text-white">{shortest.total_distance_km} km</strong>
              <span>Walk Time:</span>
              <strong className="text-white">{shortest.estimated_duration_h} h</strong>
              <span>Avg Slope:</span>
              <strong className={shortest.avg_slope_deg > safe?.avg_slope_deg ? 'text-amber-400' : 'text-white'}>
                {shortest.avg_slope_deg}°
              </strong>
              <span>Max Slope:</span>
              <strong className="text-orange-400">{shortest.max_slope_deg}°</strong>
              <span>Hazards:</span>
              <strong className="text-white">{shortest.hazard_segments.length}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Rationale Recommendation */}
      <div className="bg-mars-dark/60 border border-mars-border p-2.5 rounded-lg text-[11px] text-slate-300 flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white">Scientific Evaluation: </strong>
          {comparison.recommendation}
        </div>
      </div>
    </div>
  );
};
