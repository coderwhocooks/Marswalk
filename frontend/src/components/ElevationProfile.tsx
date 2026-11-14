import React, { useState } from 'react';
import { RoutePlanResponse } from '../types';
import { TrendingUp, AlertTriangle } from 'lucide-react';

interface ElevationProfileProps {
  routePlan?: RoutePlanResponse;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({ routePlan }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!routePlan || routePlan.elevation_profile.length === 0) {
    return (
      <div className="h-44 flex flex-col items-center justify-center text-mars-subtle text-xs bg-mars-panel/50 border border-mars-border rounded-xl">
        <TrendingUp className="w-6 h-6 mb-2 opacity-40" />
        No active route calculated. Select staging & destination on map to generate elevation cross-section.
      </div>
    );
  }

  const elevs = routePlan.elevation_profile;
  const slopes = routePlan.slope_profile;
  const count = elevs.length;
  const minElev = Math.min(...elevs);
  const maxElev = Math.max(...elevs);
  const elevRange = Math.max(maxElev - minElev, 10.0);

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 110;
  const padding = { top: 10, bottom: 20, left: 45, right: 20 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Build points string for SVG polygon & polyline
  const points = elevs.map((e, i) => {
    const x = padding.left + (i / (count - 1)) * plotWidth;
    const y = padding.top + plotHeight - ((e - minElev) / elevRange) * plotHeight;
    return { x, y, elev: e, slope: slopes[i] || 0 };
  });

  const polylineStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPolygonStr = `${padding.left},${padding.top + plotHeight} ` +
    polylineStr +
    ` ${padding.left + plotWidth},${padding.top + plotHeight}`;

  const currentHover = hoverIdx !== null && hoverIdx >= 0 && hoverIdx < count ? points[hoverIdx] : null;

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-mars-accent" />
          <span className="font-semibold text-white tracking-wide">Topographic Traverse Profile</span>
          <span className="text-mars-subtle text-[11px]">({routePlan.total_distance_km} km)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-mars-subtle">Gain: <strong className="text-emerald-400">+{routePlan.elevation_gain_m}m</strong></span>
          <span className="text-mars-subtle">Loss: <strong className="text-rose-400">-{routePlan.elevation_loss_m}m</strong></span>
          <span className="text-mars-subtle">Max Slope: <strong className={routePlan.max_slope_deg > 15 ? 'text-amber-400' : 'text-sky-400'}>{routePlan.max_slope_deg}°</strong></span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-28 cursor-crosshair select-none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            const xCoord = relX * svgWidth;
            if (xCoord >= padding.left && xCoord <= padding.left + plotWidth) {
              const ratio = (xCoord - padding.left) / plotWidth;
              const idx = Math.round(ratio * (count - 1));
              setHoverIdx(Math.max(0, Math.min(count - 1, idx)));
            }
          }}
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0B0D13" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left + plotWidth}
            y2={padding.top}
            stroke="#232A3B"
            strokeDasharray="3 3"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotHeight / 2}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight / 2}
            stroke="#232A3B"
            strokeDasharray="3 3"
          />
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#232A3B"
          />

          {/* Y Axis Labels */}
          <text x={padding.left - 6} y={padding.top + 4} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="monospace">
            {Math.round(maxElev)}m
          </text>
          <text x={padding.left - 6} y={padding.top + plotHeight + 3} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="monospace">
            {Math.round(minElev)}m
          </text>

          {/* X Axis Labels */}
          <text x={padding.left} y={svgHeight - 4} fill="#64748B" fontSize="9" textAnchor="start" fontFamily="monospace">
            0.0 km
          </text>
          <text x={padding.left + plotWidth} y={svgHeight - 4} fill="#64748B" fontSize="9" textAnchor="end" fontFamily="monospace">
            {routePlan.total_distance_km} km
          </text>

          {/* Area Fill */}
          <polygon points={areaPolygonStr} fill="url(#elevGradient)" />

          {/* Elevation Profile Line */}
          <polyline
            points={polylineStr}
            fill="none"
            stroke={routePlan.mode === 'safe' ? '#38BDF8' : '#F97316'}
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Hazard Zones Highlight */}
          {points.map((p, i) => {
            if (p.slope > 14.0) {
              return (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="2.5"
                  fill="#F43F5E"
                  stroke="#FFFFFF"
                  strokeWidth="0.8"
                />
              );
            }
            return null;
          })}

          {/* Hover Scrubber Line & Dot */}
          {currentHover && (
            <g>
              <line
                x1={currentHover.x}
                y1={padding.top}
                x2={currentHover.x}
                y2={padding.top + plotHeight}
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={currentHover.x}
                cy={currentHover.y}
                r="4.5"
                fill="#38BDF8"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Hover Readout Tooltip */}
        {currentHover && hoverIdx !== null && (
          <div className="absolute top-2 right-4 bg-mars-dark/95 border border-mars-border px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-3 shadow-lg">
            <span>Dist: <strong className="text-white">{((hoverIdx / (count - 1)) * routePlan.total_distance_km).toFixed(2)} km</strong></span>
            <span>Elev: <strong className="text-mars-accent">{currentHover.elev.toFixed(1)} m</strong></span>
            <span>Slope: <strong className={currentHover.slope > 14 ? 'text-rose-400' : 'text-emerald-400'}>{currentHover.slope.toFixed(1)}°</strong></span>
          </div>
        )}
      </div>

      {routePlan.hazard_segments.length > 0 && (
        <div className="text-[11px] text-amber-300/90 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{routePlan.hazard_segments.length} sectors with slope exceeding 12° detected. Astronaut locomotion will encounter increased metabolic resistance.</span>
        </div>
      )}
    </div>
  );
};
