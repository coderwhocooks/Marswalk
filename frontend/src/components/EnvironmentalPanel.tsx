import React from 'react';
import { EnvironmentalConditions } from '../types';
import { Thermometer, Wind, CloudDrizzle, Sun, Radio, Activity } from 'lucide-react';

interface EnvironmentalPanelProps {
  conditions?: EnvironmentalConditions;
  lmstHour: number;
  missionDurationHours: number;
  onLmstChange: (hour: number) => void;
}

export const EnvironmentalPanel: React.FC<EnvironmentalPanelProps> = ({
  conditions,
  lmstHour,
  missionDurationHours,
  onLmstChange
}) => {
  if (!conditions) {
    return (
      <div className="bg-mars-panel border border-mars-border rounded-xl p-4 text-xs text-mars-subtle">
        Loading Mars 2020 MEDA telemetry...
      </div>
    );
  }

  return (
    <div className="bg-mars-panel border border-mars-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-mars-border pb-2.5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold text-white tracking-wide">Surface Environmental Intelligence</h3>
        </div>
        <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded font-mono">
          PERSEVERANCE MEDA
        </span>
      </div>

      {/* LMST Time Slider */}
      <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex flex-col gap-1.5 text-xs">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-mars-subtle font-medium">Local True Solar Time (LMST):</span>
          <span className="font-mono font-bold text-white bg-mars-border px-2 py-0.5 rounded">
            {Math.floor(lmstHour).toString().padStart(2, '0')}:{Math.floor((lmstHour % 1) * 60).toString().padStart(2, '0')} SOL
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="23.75"
          step="0.25"
          value={lmstHour}
          onChange={(e) => onLmstChange(Number(e.target.value))}
          className="w-full accent-mars-red cursor-pointer h-1.5 bg-mars-border rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-mars-subtle font-mono">
          <span>00:00 (Night)</span>
          <span>06:00 (Dawn)</span>
          <span>12:00 (Noon)</span>
          <span>18:00 (Dusk)</span>
        </div>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Surface & Air Temp */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <Thermometer className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">Temperature</div>
            <div className="font-mono text-white text-xs font-bold">
              {conditions.surface_temp_c}°C <span className="text-[10px] text-mars-subtle font-normal">(GTS)</span>
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">Air: {conditions.air_temp_c}°C</div>
          </div>
        </div>

        {/* Pressure */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">Pressure (PS)</div>
            <div className="font-mono text-white text-xs font-bold">
              {conditions.pressure_pa} Pa
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">{(conditions.pressure_pa / 100).toFixed(2)} mbar</div>
          </div>
        </div>

        {/* Wind Speed & Direction */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">Wind Vector</div>
            <div className="font-mono text-white text-xs font-bold">
              {conditions.wind_speed_ms} m/s
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">115° ESE Katabatic</div>
          </div>
        </div>

        {/* Dust Opacity */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <CloudDrizzle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">Dust Opacity (RDS)</div>
            <div className="font-mono text-white text-xs font-bold">
              τ = {conditions.dust_optical_depth}
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">Nominal Atmosphere</div>
          </div>
        </div>

        {/* Solar Downwelling Flux */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">Solar Irradiance</div>
            <div className="font-mono text-white text-xs font-bold">
              {conditions.solar_flux_wm2} W/m²
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">Elev: {conditions.solar_elevation_deg}°</div>
          </div>
        </div>

        {/* Ionizing Radiation Dose */}
        <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase text-mars-subtle font-semibold">GCR Ionizing Dose</div>
            <div className="font-mono text-white text-xs font-bold">
              {conditions.radiation_dose_msv} mSv
            </div>
            <div className="text-[10px] text-mars-subtle font-mono">MSL RAD Benchmark</div>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-mars-subtle bg-mars-dark/30 p-2 rounded border border-mars-border/40 font-mono">
        Station: Perseverance M2020-MEDA | Location: Jezero Floor (18.44°N, 77.45°E)
      </div>
    </div>
  );
};
