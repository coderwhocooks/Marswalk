import React from 'react';
import { MissionSimulateResponse } from '../types';
import { BatteryCharging, Droplet, Wind, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface SimulationGaugeProps {
  simulation?: MissionSimulateResponse;
  scienceDurationMin: number;
  onScienceDurationChange: (min: number) => void;
}

export const SimulationGauge: React.FC<SimulationGaugeProps> = ({
  simulation,
  scienceDurationMin,
  onScienceDurationChange
}) => {
  if (!simulation) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle">
        Calculate a route to simulate astronaut life-support feasibility.
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    if (status === 'FEASIBLE') return 'bg-emerald-500 text-black border-emerald-400';
    if (status === 'MARGINAL') return 'bg-amber-500 text-black border-amber-400';
    return 'bg-rose-500 text-white border-rose-400';
  };

  const getBarColor = (pct: number) => {
    if (pct > 40) return 'bg-emerald-500';
    if (pct >= 20) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3">
      {/* Header and Feasibility Badge */}
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-mars-accent" />
          <h3 className="text-xs font-bold text-white tracking-wide">Astronaut Life-Support Feasibility</h3>
        </div>
        <span className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold border shadow-sm ${getStatusColor(simulation.feasibility_status)}`}>
          {simulation.feasibility_status}
        </span>
      </div>

      {/* Dwell Time Slider */}
      <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5 text-xs">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-mars-subtle font-medium">Planned Science Target Dwell:</span>
          <span className="font-mono font-bold text-mars-accent bg-mars-border px-2 py-0.5 rounded">
            {scienceDurationMin} min ({((scienceDurationMin) / 60).toFixed(1)} h)
          </span>
        </div>
        <input
          type="range"
          min="15"
          max="180"
          step="15"
          value={scienceDurationMin}
          onChange={(e) => onScienceDurationChange(Number(e.target.value))}
          className="w-full accent-mars-accent cursor-pointer h-1.5 bg-mars-border rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-mars-subtle font-mono">
          <span>15 min (Brief)</span>
          <span>45 min (Nominal)</span>
          <span>120 min (Deep Sampling)</span>
        </div>
      </div>

      {/* Timeline Breakdown */}
      <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
        <div className="bg-mars-dark/40 border border-mars-border p-2 rounded">
          <div className="text-[10px] text-mars-subtle">Walk</div>
          <div className="font-mono font-bold text-white text-xs">{simulation.walk_time_h}h</div>
        </div>
        <div className="bg-mars-dark/40 border border-mars-border p-2 rounded">
          <div className="text-[10px] text-mars-subtle">Science</div>
          <div className="font-mono font-bold text-white text-xs">{simulation.science_time_h}h</div>
        </div>
        <div className="bg-mars-dark/40 border border-mars-border p-2 rounded">
          <div className="text-[10px] text-mars-subtle">Buffer</div>
          <div className="font-mono font-bold text-white text-xs">{simulation.contingency_time_h}h</div>
        </div>
        <div className="bg-mars-dark/40 border border-mars-accent/40 p-2 rounded">
          <div className="text-[10px] text-mars-accent font-semibold">Total EVA</div>
          <div className="font-mono font-bold text-mars-accent text-xs">{simulation.total_mission_time_h}h</div>
        </div>
      </div>

      {/* Consumables Drawdown Bars */}
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Oxygen */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Wind className="w-3.5 h-3.5 text-sky-400" />
              Oxygen (Primary O2)
            </span>
            <span className="font-mono">
              <strong className={simulation.o2_remaining_pct < 20 ? 'text-rose-400' : 'text-white'}>
                {simulation.o2_remaining_pct.toFixed(1)}%
              </strong>{' '}
              <span className="text-[10px] text-mars-subtle">({simulation.o2_remaining_kg} kg left)</span>
            </span>
          </div>
          <div className="w-full bg-mars-dark border border-mars-border h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getBarColor(simulation.o2_remaining_pct)}`}
              style={{ width: `${Math.min(100, Math.max(0, simulation.o2_remaining_pct))}%` }}
            />
          </div>
        </div>

        {/* Battery Power */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300">
              <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
              Suit Battery Energy
            </span>
            <span className="font-mono">
              <strong className={simulation.battery_remaining_pct < 20 ? 'text-rose-400' : 'text-white'}>
                {simulation.battery_remaining_pct.toFixed(1)}%
              </strong>{' '}
              <span className="text-[10px] text-mars-subtle">({Math.round(simulation.battery_remaining_wh)} Wh left)</span>
            </span>
          </div>
          <div className="w-full bg-mars-dark border border-mars-border h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getBarColor(simulation.battery_remaining_pct)}`}
              style={{ width: `${Math.min(100, Math.max(0, simulation.battery_remaining_pct))}%` }}
            />
          </div>
        </div>

        {/* Cooling Water */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Droplet className="w-3.5 h-3.5 text-cyan-400" />
              Sublimator Cooling Water
            </span>
            <span className="font-mono">
              <strong className={simulation.cooling_water_remaining_pct < 20 ? 'text-rose-400' : 'text-white'}>
                {simulation.cooling_water_remaining_pct.toFixed(1)}%
              </strong>{' '}
              <span className="text-[10px] text-mars-subtle">({simulation.cooling_water_remaining_kg} kg left)</span>
            </span>
          </div>
          <div className="w-full bg-mars-dark border border-mars-border h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${getBarColor(simulation.cooling_water_remaining_pct)}`}
              style={{ width: `${Math.min(100, Math.max(0, simulation.cooling_water_remaining_pct))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottlenecks and Contingencies */}
      {simulation.bottlenecks.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg text-[11px] text-rose-300 flex flex-col gap-1">
          <div className="font-bold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Safety Reserve Warning
          </div>
          {simulation.bottlenecks.map((b, i) => (
            <div key={i} className="text-[10px] text-rose-200">
              • {b}
            </div>
          ))}
        </div>
      )}

      {simulation.actionable_recommendations.length > 0 && (
        <div className="bg-sky-500/10 border border-sky-500/30 p-2.5 rounded-lg text-[11px] text-sky-200 flex flex-col gap-1">
          <div className="font-bold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
            Recommended Adjustments
          </div>
          {simulation.actionable_recommendations.map((r, i) => (
            <div key={i} className="text-[10px] text-sky-100">
              • {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
