import React, { useState, useEffect } from 'react';
import { ReturnabilityResponse, EmergencyEventResponse } from '../types';
import { RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert, ArrowLeftRight, Zap, RefreshCw } from 'lucide-react';
import { evaluateReturnability, assessEmergencyEvent } from '../services/api';
import { LocationHoverWrapper } from './LocationDetailTooltip';

interface ReturnabilityPanelProps {
  startCoords: [number, number];
  targetCoords: [number, number];
  onSelectReturnRoute?: (route: any) => void;
}

export const ReturnabilityPanel: React.FC<ReturnabilityPanelProps> = ({
  startCoords,
  targetCoords,
  onSelectReturnRoute
}) => {
  const [returnability, setReturnability] = useState<ReturnabilityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [emergencyResult, setEmergencyResult] = useState<EmergencyEventResponse | null>(null);
  const [simSpeedFactor, setSimSpeedFactor] = useState<number>(0.5); // 50% mobility
  const [simO2Remain, setSimO2Remain] = useState<number>(0.45); // 0.45 kg O2 remaining

  const loadReturnability = async () => {
    setLoading(true);
    try {
      const res = await evaluateReturnability({
        startLon: startCoords[0],
        startLat: startCoords[1],
        goalLon: targetCoords[0],
        goalLat: targetCoords[1]
      });
      setReturnability(res);
      if (res.preferred_return_route && onSelectReturnRoute) {
        onSelectReturnRoute(res.preferred_return_route);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateEmergency = async () => {
    try {
      // Evaluate from midway point
      const midLon = (startCoords[0] + targetCoords[0]) / 2.0;
      const midLat = (startCoords[1] + targetCoords[1]) / 2.0;

      const res = await assessEmergencyEvent({
        currentLon: midLon,
        currentLat: midLat,
        habitatLon: startCoords[0],
        habitatLat: startCoords[1],
        speedFactor: simSpeedFactor,
        remainingO2Kg: simO2Remain
      });
      setEmergencyResult(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadReturnability();
  }, [startCoords, targetCoords]);

  if (loading || !returnability) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-mars-accent" />
        Evaluating continuous return capability along traverse...
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'FEASIBLE':
        return <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-mono text-[10px]">RETURN FEASIBLE</span>;
      case 'FEASIBLE_REDUCED_CONTINGENCY':
        return <span className="bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded font-mono text-[10px]">REDUCED CONTINGENCY</span>;
      case 'CONSTRAINED':
        return <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-mono text-[10px]">CONSTRAINED</span>;
      default:
        return <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded font-mono text-[10px]">INFEASIBLE</span>;
    }
  };

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-white tracking-wide">Returnability Intelligence</h3>
        </div>
        {getStatusBadge(returnability.overall_status)}
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {returnability.point_of_no_return_lonlat ? (
          <LocationHoverWrapper
            info={{
              name: 'Point of No Return (PNR)',
              category: 'Exploration Waypoint',
              lon: returnability.point_of_no_return_lonlat[0],
              lat: returnability.point_of_no_return_lonlat[1],
              score: returnability.min_return_margin_pct,
              scoreLabel: 'Min. Reserve Margin',
              badge: 'CRITICAL PNR',
              badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
              description: `Critical traverse limit: beyond this checkpoint, return path duration and metabolic draw will compromise mandatory emergency life support reserves.`,
              keyFacts: [
                { label: 'Checkpoint Index', value: `#${returnability.point_of_no_return_idx}` },
                { label: 'Reserve Margin', value: `${returnability.min_return_margin_pct}% O₂` }
              ],
              actionHint: 'Evaluated continuously by Returnability Engine'
            }}
            className="w-full"
          >
            <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1 w-full text-left hover:border-mars-subtle transition">
              <div className="text-mars-subtle font-medium">Point of No Return (PNR)</div>
              <div className="font-mono font-bold text-white text-xs">
                {`${returnability.point_of_no_return_lonlat[0].toFixed(3)}°E, ${returnability.point_of_no_return_lonlat[1].toFixed(3)}°N`}
              </div>
              <div className="text-[10px] text-cyan-400">
                Checkpoint #{returnability.point_of_no_return_idx}
              </div>
            </div>
          </LocationHoverWrapper>
        ) : (
          <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
            <div className="text-mars-subtle font-medium">Point of No Return (PNR)</div>
            <div className="font-mono font-bold text-white text-xs">Destination Safe</div>
            <div className="text-[10px] text-emerald-400">Full Margin Available</div>
          </div>
        )}

        <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
          <div className="text-mars-subtle font-medium">Min. Reserve Margin</div>
          <div className="font-mono font-bold text-white text-xs">
            {returnability.min_return_margin_pct}% O₂
          </div>
          <div className="text-[10px] text-emerald-400">
            &gt; 20% Mandatory Buffer
          </div>
        </div>
      </div>

      {/* Preferred Return Route Stats */}
      {returnability.preferred_return_route && (
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5 text-[11px]">
          <div className="flex items-center justify-between font-bold text-white text-xs">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Independent Return Corridor
            </span>
            <span className="font-mono text-[10px] text-mars-subtle">Safe Mode</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center bg-mars-panel/40 p-1.5 rounded text-[10px]">
            <div>
              <div className="text-mars-subtle">Return Dist</div>
              <div className="font-mono font-bold text-white">{returnability.preferred_return_route.total_distance_km} km</div>
            </div>
            <div>
              <div className="text-mars-subtle">Duration</div>
              <div className="font-mono font-bold text-white">{returnability.preferred_return_route.estimated_duration_h} h</div>
            </div>
            <div>
              <div className="text-mars-subtle">Max Slope</div>
              <div className="font-mono font-bold text-white">{returnability.preferred_return_route.max_slope_deg}°</div>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Event Simulator */}
      <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Dynamic Emergency Simulator
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <label className="text-mars-subtle block mb-1">Mobility Impairment: {Math.round(simSpeedFactor * 100)}%</label>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.1"
              value={simSpeedFactor}
              onChange={(e) => setSimSpeedFactor(parseFloat(e.target.value))}
              className="w-full accent-mars-red"
            />
          </div>
          <div>
            <label className="text-mars-subtle block mb-1">Remaining O₂: {simO2Remain} kg</label>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={simO2Remain}
              onChange={(e) => setSimO2Remain(parseFloat(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>
        </div>

        <button
          onClick={handleSimulateEmergency}
          className="w-full py-1.5 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-200 text-xs font-bold rounded flex items-center justify-center gap-1.5 transition"
        >
          <Zap className="w-3.5 h-3.5" />
          Simulate Off-Nominal Abort Event
        </button>

        {emergencyResult && (
          <div className="bg-mars-panel/60 border border-mars-border p-2 rounded flex flex-col gap-1.5 text-[11px] mt-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Recommended Action:</span>
              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                emergencyResult.action_recommendation === 'CONTINUE'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : emergencyResult.action_recommendation === 'REPLAN'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}>
                {emergencyResult.action_recommendation}
              </span>
            </div>
            <ul className="text-[10px] text-slate-300 list-disc list-inside">
              {emergencyResult.reasoning.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
