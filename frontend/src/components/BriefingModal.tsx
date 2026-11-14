import React, { useState } from 'react';
import { X, Copy, Check, Printer, FileText } from 'lucide-react';

interface BriefingModalProps {
  isOpen: boolean;
  briefingData: any;
  markdownReport: string;
  onClose: () => void;
}

export const BriefingModal: React.FC<BriefingModalProps> = ({
  isOpen,
  briefingData,
  markdownReport,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !briefingData) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const meta = briefingData.mission_metadata;
  const plan = briefingData.traverse_plan;
  const sel = plan.selected_route;
  const sci = briefingData.science_objective;
  const env = briefingData.environmental_conditions;
  const lss = briefingData.life_support_simulation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-mars-panel border border-mars-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-mars-border px-6 py-4 bg-mars-dark/80">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-mars-red" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                NASA Space Apps 2026 — Expedition Mission Briefing
              </h2>
              <div className="text-[11px] text-mars-subtle font-mono">
                Mission ID: {meta.mission_id} | Body: {meta.destination_body} ({meta.region})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg border border-mars-border bg-mars-panel hover:bg-mars-border/80 text-white text-xs flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied MD!' : 'Copy Markdown'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-mars-border bg-mars-panel hover:bg-mars-border/80 text-white text-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-mars-border bg-mars-panel hover:bg-mars-border/80 text-mars-subtle hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-xs text-slate-300 font-sans">
          {/* Mission Meta Banner */}
          <div className="grid grid-cols-4 gap-3 bg-mars-dark/60 border border-mars-border p-3 rounded-xl font-mono text-[11px]">
            <div>
              <div className="text-mars-subtle text-[10px] uppercase">Crew Roster</div>
              <div className="text-white font-semibold">{meta.crew.join(', ')}</div>
            </div>
            <div>
              <div className="text-mars-subtle text-[10px] uppercase">Planetary Datum</div>
              <div className="text-white font-semibold">{meta.geodetic_datum}</div>
            </div>
            <div>
              <div className="text-mars-subtle text-[10px] uppercase">Target Site</div>
              <div className="text-white font-semibold">{plan.destination_point.name}</div>
            </div>
            <div>
              <div className="text-mars-subtle text-[10px] uppercase">Feasibility Verdict</div>
              <div className={`font-bold ${lss.is_feasible ? 'text-emerald-400' : 'text-rose-400'}`}>
                {lss.feasibility_status}
              </div>
            </div>
          </div>

          {/* Section 1: Route & Topography */}
          <div className="border border-mars-border rounded-xl p-4 bg-mars-dark/30 flex flex-col gap-2.5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b border-mars-border/60 pb-1.5">
              <span>1.0</span> Traverse & Navigational Parameters
            </h3>
            <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
              <div>
                <span className="text-mars-subtle">Staging Base: </span>
                <span className="text-white">{plan.staging_point.name} ({plan.staging_point.lat.toFixed(4)}°N, {plan.staging_point.lon.toFixed(4)}°E)</span>
              </div>
              <div>
                <span className="text-mars-subtle">Target Objective: </span>
                <span className="text-white">{plan.destination_point.name} ({plan.destination_point.lat.toFixed(4)}°N, {plan.destination_point.lon.toFixed(4)}°E)</span>
              </div>
              <div>
                <span className="text-mars-subtle">Strategy Mode: </span>
                <span className="text-mars-accent uppercase font-bold">{sel.mode}</span>
              </div>
              <div>
                <span className="text-mars-subtle">Traverse Distance: </span>
                <span className="text-white font-bold">{sel.total_distance_km} km</span>
              </div>
              <div>
                <span className="text-mars-subtle">Walking Duration: </span>
                <span className="text-white font-bold">{sel.walking_time_h} h</span>
              </div>
              <div>
                <span className="text-mars-subtle">Slope Gradient: </span>
                <span className="text-white">Avg {sel.avg_slope_deg}° / Max {sel.max_slope_deg}°</span>
              </div>
              <div>
                <span className="text-mars-subtle">Vertical Relief: </span>
                <span className="text-white">+{sel.elevation_gain_m}m / -{sel.elevation_loss_m}m</span>
              </div>
              <div>
                <span className="text-mars-subtle">Hazard Sectors (&gt;12°): </span>
                <span className="text-amber-400">{sel.hazard_count} detected</span>
              </div>
              <div>
                <span className="text-mars-subtle">Waypoints: </span>
                <span className="text-white">{sel.waypoints_count} nodes</span>
              </div>
            </div>
          </div>

          {/* Section 2: Scientific Objective */}
          <div className="border border-mars-border rounded-xl p-4 bg-mars-dark/30 flex flex-col gap-2.5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b border-mars-border/60 pb-1.5">
              <span>2.0</span> Geological Investigation Target
            </h3>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-mars-subtle">Target: </span>
                <strong className="text-white">{sci.target_name}</strong>
              </div>
              <div>
                <span className="text-mars-subtle">Stratigraphic Formation: </span>
                <span className="text-white">{sci.geological_unit}</span>
              </div>
              <div className="col-span-2">
                <span className="text-mars-subtle">Mineralogical Detections: </span>
                <span className="text-purple-300">{sci.mineralogy}</span>
              </div>
              <div className="col-span-2 bg-mars-panel/80 p-2.5 rounded border border-mars-border/60">
                <span className="text-mars-subtle block mb-0.5">Primary Scientific Objective:</span>
                <span className="text-white">{sci.primary_objective}</span>
              </div>
              <div>
                <span className="text-mars-subtle">Supporting Instruments: </span>
                <span className="text-white">{sci.supporting_instruments}</span>
              </div>
              <div>
                <span className="text-mars-subtle">Product Provenance: </span>
                <span className="text-mars-subtle font-mono">{sci.product_provenance}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Environmental Telemetry */}
          <div className="border border-mars-border rounded-xl p-4 bg-mars-dark/30 flex flex-col gap-2.5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b border-mars-border/60 pb-1.5">
              <span>3.0</span> Environmental Conditions (Perseverance MEDA)
            </h3>
            <div className="grid grid-cols-4 gap-3 font-mono text-[11px]">
              <div>
                <div className="text-mars-subtle text-[10px]">Solar Hour</div>
                <div className="text-white">{env.lmst_hour.toFixed(1)} LMST</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Surface Temp</div>
                <div className="text-white">{env.surface_temperature_c}°C</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Pressure</div>
                <div className="text-white">{env.pressure_pa} Pa</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Wind Velocity</div>
                <div className="text-white">{env.wind_speed_ms} m/s</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Dust Optical Depth</div>
                <div className="text-white">τ = {env.dust_optical_depth}</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Solar Downwelling</div>
                <div className="text-white">{env.solar_irradiance_wm2} W/m²</div>
              </div>
              <div className="col-span-2">
                <div className="text-mars-subtle text-[10px]">Estimated EVA Radiation</div>
                <div className="text-indigo-300 font-bold">{env.accumulated_radiation_dose_msv} mSv (MSL RAD Model)</div>
              </div>
            </div>
          </div>

          {/* Section 4: Life Support Simulation */}
          <div className="border border-mars-border rounded-xl p-4 bg-mars-dark/30 flex flex-col gap-2.5">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b border-mars-border/60 pb-1.5">
              <span>4.0</span> Life-Support Resource Budget & Margin Analysis
            </h3>
            <div className="grid grid-cols-4 gap-3 font-mono text-[11px]">
              <div>
                <div className="text-mars-subtle text-[10px]">Total EVA Duration</div>
                <div className="text-white font-bold">{lss.total_eva_time_h} h</div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Oxygen Margin</div>
                <div className={`font-bold ${lss.oxygen_remaining_pct < 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {lss.oxygen_remaining_pct}%
                </div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Battery Margin</div>
                <div className={`font-bold ${lss.battery_remaining_pct < 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {lss.battery_remaining_pct}%
                </div>
              </div>
              <div>
                <div className="text-mars-subtle text-[10px]">Cooling Water Margin</div>
                <div className={`font-bold ${lss.cooling_water_remaining_pct < 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {lss.cooling_water_remaining_pct}%
                </div>
              </div>
            </div>

            {lss.bottlenecks.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded text-[11px] text-rose-300 flex flex-col gap-1 mt-1">
                <div className="font-bold">Identified Safety Bottlenecks:</div>
                {lss.bottlenecks.map((b: string, i: number) => (
                  <div key={i}>• {b}</div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Provenance Table */}
          <div className="border border-mars-border rounded-xl p-4 bg-mars-dark/30 flex flex-col gap-2">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-2 border-b border-mars-border/60 pb-1.5">
              <span>5.0</span> Dataset Provenance & Spatial Audit Trail
            </h3>
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="border-b border-mars-border text-mars-subtle">
                  <th className="py-1">Dataset</th>
                  <th className="py-1">Product Identifier</th>
                  <th className="py-1">Resolution</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mars-border/40">
                {briefingData.data_provenance.map((p: any, idx: number) => (
                  <tr key={idx} className="text-slate-300">
                    <td className="py-1 font-sans">{p.dataset}</td>
                    <td className="py-1 text-mars-accent">{p.product_id}</td>
                    <td className="py-1">{p.resolution}</td>
                    <td className="py-1 text-mars-subtle font-sans">{p.mission_instrument}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-mars-subtle bg-mars-dark/50 p-3 rounded-lg border border-mars-border/50 italic">
            {briefingData.disclaimer}
          </div>
        </div>
      </div>
    </div>
  );
};
