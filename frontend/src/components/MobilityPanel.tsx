import React, { useState, useEffect } from 'react';
import { RoutePlanResponse, MobilityResponse } from '../types';
import { Activity, Gauge, BatteryCharging, Clock, Flame, UserCheck, RefreshCw } from 'lucide-react';
import { estimateMobility } from '../services/api';

interface MobilityPanelProps {
  routePlan?: RoutePlanResponse;
}

export const MobilityPanel: React.FC<MobilityPanelProps> = ({ routePlan }) => {
  const [mobility, setMobility] = useState<MobilityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [astronautMass, setAstronautMass] = useState<number>(80.0);
  const [suitMass, setSuitMass] = useState<number>(120.0);

  const calculateMobility = async () => {
    if (!routePlan || routePlan.coords_lonlat.length < 2) return;
    setLoading(true);
    try {
      // Discretize distance and slope arrays from route plan
      const stepDist = routePlan.total_distance_m / Math.max(routePlan.slope_profile.length, 1);
      const distances = Array(routePlan.slope_profile.length).fill(stepDist);
      const slopes = routePlan.slope_profile;

      const res = await estimateMobility({
        distancesM: distances,
        slopesDeg: slopes,
        astronautMassKg: astronautMass,
        suitMassKg: suitMass
      });
      setMobility(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateMobility();
  }, [routePlan, astronautMass, suitMass]);

  if (!routePlan) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle">
        Plan an exploration route to calculate physiological human mobility and fatigue metrics in 0.38g.
      </div>
    );
  }

  if (loading || !mobility) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-mars-accent" />
        Calculating Santee-Minetti biomechanical work and fatigue accumulation...
      </div>
    );
  }

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-400" />
          <h3 className="font-bold text-white tracking-wide">Human Mobility & Fatigue Estimator</h3>
        </div>
        <span className="text-[10px] text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded font-mono">
          0.38g SANTEE-MINETTI
        </span>
      </div>

      {/* Suit & Astronaut Mass Controls */}
      <div className="bg-mars-dark/50 border border-mars-border p-2 rounded-lg grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <label className="text-mars-subtle block text-[10px] mb-0.5">Astronaut Mass: {astronautMass} kg</label>
          <input
            type="range"
            min="60"
            max="110"
            step="5"
            value={astronautMass}
            onChange={(e) => setAstronautMass(parseFloat(e.target.value))}
            className="w-full accent-mars-red"
          />
        </div>
        <div>
          <label className="text-mars-subtle block text-[10px] mb-0.5">Suit Mass (xEMU): {suitMass} kg</label>
          <input
            type="range"
            min="90"
            max="160"
            step="5"
            value={suitMass}
            onChange={(e) => setSuitMass(parseFloat(e.target.value))}
            className="w-full accent-sky-400"
          />
        </div>
      </div>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-mars-subtle font-semibold uppercase">Avg Walk Speed</div>
            <div className="font-mono text-white text-xs font-bold">{mobility.avg_speed_ms} m/s</div>
            <div className="text-[10px] text-mars-subtle font-mono">{(mobility.avg_speed_ms * 3.6).toFixed(1)} km/h</div>
          </div>
        </div>

        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-mars-subtle font-semibold uppercase">Metabolic Power</div>
            <div className="font-mono text-white text-xs font-bold">{mobility.avg_metabolic_power_w} W</div>
            <div className="text-[10px] text-mars-subtle font-mono">Peak: {mobility.peak_metabolic_power_w} W</div>
          </div>
        </div>

        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <BatteryCharging className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-mars-subtle font-semibold uppercase">Peak Fatigue</div>
            <div className="font-mono text-white text-xs font-bold">{mobility.peak_fatigue_pct}%</div>
            <div className="text-[10px] text-emerald-400 font-mono">Controlled Pacing</div>
          </div>
        </div>

        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-mars-subtle font-semibold uppercase">Total Energy</div>
            <div className="font-mono text-white text-xs font-bold">{mobility.total_energy_kcal} kcal</div>
            <div className="text-[10px] text-mars-subtle font-mono">Rest: {(mobility.total_rest_time_s / 60).toFixed(0)} min</div>
          </div>
        </div>
      </div>

      {/* Scheduled Rest Stops */}
      <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5">
        <div className="text-[10px] uppercase font-bold text-mars-subtle flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          Work-Rest Schedule ({mobility.rest_stops.length} pauses prescribed)
        </div>
        {mobility.rest_stops.length > 0 ? (
          <div className="flex flex-col gap-1 text-[10px]">
            {mobility.rest_stops.map((stop, i) => (
              <div key={i} className="bg-mars-panel/50 p-1.5 rounded flex items-center justify-between border border-mars-border/50">
                <span>At {stop.distance_along_route_m}m ({(stop.elapsed_time_s / 60).toFixed(0)} min)</span>
                <span className="font-mono text-emerald-300 font-bold">{stop.rest_duration_min} min rest</span>
                <span className="text-mars-subtle">Fatigue: {stop.fatigue_before_pct}% → {stop.fatigue_after_pct}%</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-300">
            No mandatory rest stops required: continuous fatigue remains within nominal 40% threshold.
          </div>
        )}
      </div>
    </div>
  );
};
