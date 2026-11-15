import React, { useState, useEffect } from 'react';
import { ConfidenceResponse, MonteCarloResponse, SensitivityResponse } from '../types';
import { ShieldCheck, AlertTriangle, BarChart3, RefreshCw, Zap, TrendingUp, CheckCircle, Info } from 'lucide-react';
import { evaluateConfidence, runMonteCarlo, fetchSensitivity } from '../services/api';

interface ConfidencePanelProps {
  startCoords: [number, number];
  targetCoords: [number, number];
  scienceDwellMin?: number;
}

export const ConfidencePanel: React.FC<ConfidencePanelProps> = ({
  startCoords,
  targetCoords,
  scienceDwellMin = 45.0
}) => {
  const [confidence, setConfidence] = useState<ConfidenceResponse | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<MonteCarloResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isSimulatingMC, setIsSimulatingMC] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [conf, sens] = await Promise.all([
        evaluateConfidence({
          startLon: startCoords[0],
          startLat: startCoords[1],
          goalLon: targetCoords[0],
          goalLat: targetCoords[1],
          scienceDwellMin
        }),
        fetchSensitivity(startCoords[0], startCoords[1], targetCoords[0], targetCoords[1])
      ]);
      setConfidence(conf);
      setSensitivity(sens);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRunMonteCarlo = async () => {
    setIsSimulatingMC(true);
    try {
      const mc = await runMonteCarlo({
        startLon: startCoords[0],
        startLat: startCoords[1],
        goalLon: targetCoords[0],
        goalLat: targetCoords[1],
        numSimulations: 100,
        scienceDwellMin
      });
      setMonteCarlo(mc);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulatingMC(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startCoords, targetCoords, scienceDwellMin]);

  if (loading || !confidence) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-mars-accent" />
        Evaluating multi-dimensional mission confidence...
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10';
    if (score >= 70) return 'text-sky-400 border-sky-500/40 bg-sky-500/10';
    if (score >= 55) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/40 bg-rose-500/10';
  };

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-white tracking-wide">Mission Confidence Engine</h3>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${getScoreColor(confidence.overall_score)}`}>
          {confidence.confidence_level} ({confidence.overall_score}%)
        </span>
      </div>

      {/* 4 Dimension Cards */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
          <div className="text-mars-subtle font-medium">Terrain Data (CTX 20m)</div>
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-white text-xs">{confidence.terrain_confidence}%</span>
            <span className="text-[10px] text-emerald-400">High Confidence</span>
          </div>
          <div className="w-full bg-mars-border/50 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${confidence.terrain_confidence}%` }} />
          </div>
        </div>

        <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
          <div className="text-mars-subtle font-medium">Route Morphology</div>
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-white text-xs">{confidence.route_confidence}%</span>
            <span className="text-[10px] text-sky-400">Stable</span>
          </div>
          <div className="w-full bg-mars-border/50 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-sky-400 h-full rounded-full" style={{ width: `${confidence.route_confidence}%` }} />
          </div>
        </div>

        <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
          <div className="text-mars-subtle font-medium">Environment (InSight)</div>
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-white text-xs">{confidence.environment_confidence}%</span>
            <span className="text-[10px] text-purple-400">In-situ Calibrated</span>
          </div>
          <div className="w-full bg-mars-border/50 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-purple-400 h-full rounded-full" style={{ width: `${confidence.environment_confidence}%` }} />
          </div>
        </div>

        <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1">
          <div className="text-mars-subtle font-medium">Life Support Stability</div>
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-white text-xs">{confidence.resource_confidence}%</span>
            <span className="text-[10px] text-cyan-400">&gt;20% Buffer</span>
          </div>
          <div className="w-full bg-mars-border/50 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${confidence.resource_confidence}%` }} />
          </div>
        </div>
      </div>

      {/* Key Uncertainty Drivers */}
      <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5">
        <div className="text-[10px] uppercase font-bold text-mars-subtle flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Primary Uncertainty Drivers
        </div>
        <ul className="text-[11px] text-slate-300 flex flex-col gap-1 list-disc list-inside">
          {confidence.uncertainty_drivers.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </div>

      {/* Monte Carlo Uncertainty Simulation Widget */}
      <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-white text-xs">
            <BarChart3 className="w-3.5 h-3.5 text-mars-accent" />
            Monte Carlo Uncertainty Simulator
          </div>
          <button
            onClick={handleRunMonteCarlo}
            disabled={isSimulatingMC}
            className="px-2.5 py-1 bg-mars-accent/20 border border-mars-accent/40 hover:bg-mars-accent/30 text-sky-200 text-[10px] font-bold rounded flex items-center gap-1 transition"
          >
            {isSimulatingMC ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Zap className="w-3 h-3" />
                Run 100 Scenarios
              </>
            )}
          </button>
        </div>

        {monteCarlo ? (
          <div className="flex flex-col gap-2 text-[11px]">
            <div className="grid grid-cols-3 gap-2 text-center bg-mars-panel/50 p-2 rounded">
              <div>
                <div className="text-mars-subtle text-[10px]">Success Rate</div>
                <div className="text-emerald-400 font-bold font-mono text-xs">{monteCarlo.success_rate_pct}%</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Median (P50)</div>
                <div className="text-white font-bold font-mono text-xs">{monteCarlo.duration_p50_h} h</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">P90 Conservative</div>
                <div className="text-amber-400 font-bold font-mono text-xs">{monteCarlo.duration_p90_h} h</div>
              </div>
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">
              Tested ±20% walking speed, ±15% O2 rate, and ±30% dwell variation across 100 runs.
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-mars-subtle">
            Click "Run 100 Scenarios" to model stochastic variations in astronaut walking velocity, suit consumption, and dwell time.
          </div>
        )}
      </div>

      {/* Sensitivity Analysis */}
      {sensitivity && (
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5 text-[11px]">
          <div className="text-[10px] uppercase font-bold text-mars-subtle flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            Parameter Sensitivity Elasticities
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="bg-mars-panel/40 p-1.5 rounded">
              <div className="text-mars-subtle">Speed Elasticity</div>
              <div className="font-mono font-bold text-white">ε = {sensitivity.parameter_elasticities.walking_speed}</div>
            </div>
            <div className="bg-mars-panel/40 p-1.5 rounded">
              <div className="text-mars-subtle">Slope Factor</div>
              <div className="font-mono font-bold text-white">ε = {sensitivity.parameter_elasticities.slope_impedance}</div>
            </div>
            <div className="bg-mars-panel/40 p-1.5 rounded">
              <div className="text-mars-subtle">O2 Consumption</div>
              <div className="font-mono font-bold text-white">ε = {sensitivity.parameter_elasticities.o2_rate}</div>
            </div>
          </div>
          <div className="text-[10px] text-slate-300 bg-mars-panel/50 p-1.5 rounded font-mono">
            <strong>Key Bottleneck:</strong> {sensitivity.primary_failure_mode}
          </div>
        </div>
      )}
    </div>
  );
};
