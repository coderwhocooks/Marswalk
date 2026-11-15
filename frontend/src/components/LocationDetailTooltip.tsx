import React from 'react';
import {
  MapPin,
  Compass,
  Mountain,
  Sparkles,
  Home,
  ShieldAlert,
  Flame,
  Info,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export interface LocationInfo {
  name: string;
  category:
    | 'Landmark'
    | 'Science Target'
    | 'Habitat Site'
    | 'EVA Staging Base'
    | 'Exploration Waypoint'
    | 'Martian Surface'
    | 'Traverse Corridor';
  lon: number;
  lat: number;
  elevation_m?: number | null;
  slope_deg?: number | null;
  roughness_m?: number | null;
  score?: number | null;
  scoreLabel?: string;
  badge?: string;
  badgeColor?: string;
  geologicalUnit?: string;
  mineralogy?: string;
  capacity?: string;
  description?: string;
  keyFacts?: { label: string; value: string | number; color?: string }[];
  actionHint?: string;
}

export interface LocationDetailTooltipProps {
  info: LocationInfo | null;
  x?: number;
  y?: number;
  inline?: boolean;
}

/**
 * Format Areocentric coordinates into standard planetary format
 */
export function formatMarsCoords(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(lat % 1 === 0 ? 1 : 4)}° ${lat >= 0 ? 'N' : 'S'}`;
  let normLon = lon;
  while (normLon > 180) normLon -= 360;
  while (normLon < -180) normLon += 360;
  const lonStr = `${Math.abs(normLon).toFixed(normLon % 1 === 0 ? 1 : 4)}° ${normLon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

export const LocationDetailTooltip: React.FC<LocationDetailTooltipProps> = ({
  info,
  x = 0,
  y = 0,
  inline = false
}) => {
  if (!info) return null;

  // Compute category icon and color
  const getCategoryTheme = (cat: LocationInfo['category']) => {
    switch (cat) {
      case 'Landmark':
        return {
          icon: <Mountain className="w-3.5 h-3.5 text-sky-400" />,
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
        };
      case 'Science Target':
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
        };
      case 'Habitat Site':
        return {
          icon: <Home className="w-3.5 h-3.5 text-cyan-400" />,
          badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
        };
      case 'EVA Staging Base':
        return {
          icon: <MapPin className="w-3.5 h-3.5 text-emerald-400" />,
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        };
      case 'Exploration Waypoint':
        return {
          icon: <Compass className="w-3.5 h-3.5 text-amber-400" />,
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
        };
      case 'Martian Surface':
        return {
          icon: <MapPin className="w-3.5 h-3.5 text-rose-400" />,
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
        };
      default:
        return {
          icon: <Info className="w-3.5 h-3.5 text-slate-400" />,
          badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40'
        };
    }
  };

  const theme = getCategoryTheme(info.category);

  // Position adjustments to prevent overflowing viewport edges
  let style: React.CSSProperties = {};
  if (!inline) {
    const offsetX = 18;
    const offsetY = 18;
    const estimatedWidth = 320;
    const estimatedHeight = 220;

    let left = x + offsetX;
    let top = y + offsetY;

    if (typeof window !== 'undefined') {
      if (left + estimatedWidth > window.innerWidth - 20) {
        left = x - estimatedWidth - offsetX;
      }
      if (top + estimatedHeight > window.innerHeight - 20) {
        top = y - estimatedHeight - offsetY;
      }
      left = Math.max(12, left);
      top = Math.max(12, top);
    }

    style = {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      pointerEvents: 'none',
      zIndex: 9999
    };
  }

  return (
    <div
      style={style}
      className={`w-80 bg-mars-panel/95 backdrop-blur-md border border-mars-border rounded-xl shadow-2xl p-3.5 text-xs text-mars-text transition-opacity duration-150 animate-in fade-in zoom-in-95 ${
        inline ? 'relative' : ''
      }`}
    >
      {/* Header: Name & Category Badge */}
      <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-mars-border/80">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="p-1 rounded-md bg-mars-dark/80 shrink-0">{theme.icon}</div>
          <div className="truncate">
            <h4 className="font-bold text-white text-xs leading-tight truncate">{info.name}</h4>
            <div className="text-[10px] text-mars-subtle font-mono">
              {formatMarsCoords(info.lat, info.lon)}
            </div>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-[9px] font-semibold border shrink-0 uppercase tracking-wider ${
            info.badgeColor || theme.badgeBg
          }`}
        >
          {info.badge || info.category}
        </span>
      </div>

      {/* Grid of Key Numerical Parameters */}
      <div className="grid grid-cols-2 gap-1.5 mb-2.5 bg-mars-dark/60 rounded-lg p-2 border border-mars-border/50 text-[11px]">
        {info.elevation_m !== undefined && info.elevation_m !== null && (
          <div>
            <span className="text-[10px] text-mars-subtle block">Elevation (MOLA)</span>
            <span className="font-mono font-semibold text-white">
              {info.elevation_m > 0 ? '+' : ''}
              {Math.round(info.elevation_m).toLocaleString()} m
            </span>
          </div>
        )}

        {info.slope_deg !== undefined && info.slope_deg !== null && (
          <div>
            <span className="text-[10px] text-mars-subtle block">Gradient / Slope</span>
            <span
              className={`font-mono font-semibold ${
                info.slope_deg > 15
                  ? 'text-rose-400'
                  : info.slope_deg > 8
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {info.slope_deg.toFixed(1)}°
            </span>
          </div>
        )}

        {info.score !== undefined && info.score !== null && (
          <div>
            <span className="text-[10px] text-mars-subtle block">
              {info.scoreLabel || 'Priority Score'}
            </span>
            <span className="font-mono font-semibold text-mars-accent">
              {info.score.toFixed(1)}
              {info.scoreLabel?.includes('%') || info.category === 'Habitat Site' ? '%' : ' / 100'}
            </span>
          </div>
        )}

        {info.roughness_m !== undefined && info.roughness_m !== null && (
          <div>
            <span className="text-[10px] text-mars-subtle block">Roughness Scale</span>
            <span className="font-mono font-semibold text-slate-300">
              {info.roughness_m.toFixed(2)} m
            </span>
          </div>
        )}

        {info.capacity && (
          <div className="col-span-2">
            <span className="text-[10px] text-mars-subtle block">Operational Capacity</span>
            <span className="text-[10px] font-medium text-cyan-300">{info.capacity}</span>
          </div>
        )}

        {info.mineralogy && (
          <div className="col-span-2">
            <span className="text-[10px] text-mars-subtle block">Mineralogical Signature</span>
            <span className="text-[10px] text-purple-300 truncate block">{info.mineralogy}</span>
          </div>
        )}
      </div>

      {/* Narrative Description / Geological Summary */}
      {info.description && (
        <p className="text-[11px] text-slate-300 leading-relaxed mb-2 bg-mars-dark/40 p-2 rounded border border-mars-border/40">
          {info.description}
        </p>
      )}

      {/* Additional Custom Facts */}
      {info.keyFacts && info.keyFacts.length > 0 && (
        <div className="space-y-1 mb-2">
          {info.keyFacts.map((fact, idx) => (
            <div key={idx} className="flex justify-between items-center text-[10px]">
              <span className="text-mars-subtle">{fact.label}</span>
              <span className={`font-mono font-medium ${fact.color || 'text-white'}`}>
                {fact.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Contextual Action Hint */}
      {info.actionHint && (
        <div className="flex items-center gap-1 text-[9px] text-mars-subtle border-t border-mars-border/60 pt-1.5 mt-1 font-mono">
          <ChevronRight className="w-2.5 h-2.5 text-mars-accent" />
          <span>{info.actionHint}</span>
        </div>
      )}
    </div>
  );
};

/**
 * Universal Hover Wrapper: Wrap any interactive component with rich location hover details
 */
export interface LocationHoverWrapperProps {
  info: LocationInfo;
  children: React.ReactNode;
  onHoverChange?: (info: LocationInfo | null, e?: React.MouseEvent) => void;
  className?: string;
}

export const LocationHoverWrapper: React.FC<LocationHoverWrapperProps> = ({
  info,
  children,
  onHoverChange,
  className = ''
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [coords, setCoords] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    setCoords({ x: e.clientX, y: e.clientY });
    if (onHoverChange) onHoverChange(info, e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (onHoverChange) onHoverChange(null);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block ${className}`}
    >
      {children}
      {isHovered && <LocationDetailTooltip info={info} x={coords.x} y={coords.y} />}
    </div>
  );
};
