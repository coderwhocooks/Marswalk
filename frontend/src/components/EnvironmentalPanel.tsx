import React, { useState, useEffect } from 'react';
import { EnvironmentalConditions, NasaWeatherResponse } from '../types';
import { Thermometer, Wind, CloudDrizzle, Sun, Radio, Activity, Satellite, RefreshCw } from 'lucide-react';
import { fetchNasaWeather } from '../services/api';

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
  const [source, setSource] = useState<'meda' | 'insight'>('meda');
  const [nasaWeather, setNasaWeather] = useState<NasaWeatherResponse | null>(null);
  const [loadingNasa, setLoadingNasa] = useState<boolean>(false);

  useEffect(() => {
    if (source === 'insight' && !nasaWeather) {
      setLoadingNasa(true);
      fetchNasaWeather()
        .then(setNasaWeather)
        .catch(console.error)
        .finally(() => setLoadingNasa(false));
    }
  }, [source]);

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
        <div className="flex items-center gap-1.5 text-[10px]">
          <button
            onClick={() => setSource('meda')}
            className={`px-2 py-0.5 rounded font-mono transition ${
              source === 'meda'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            MEDA (Diurnal)
          </button>
          <button
            onClick={() => setSource('insight')}
            className={`px-2 py-0.5 rounded font-mono transition flex items-center gap-1 ${
              source === 'insight'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold'
                : 'text-mars-subtle hover:text-white'
            }`}
          >
            <Satellite className="w-3 h-3 text-sky-400" />
            NASA InSight (Live API)
          </button>
        </div>
      </div>

      {source === 'meda' ? (
        <>
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
        </>
      ) : (
        /* NASA InSight Real In-situ Telemetry */
        <div className="flex flex-col gap-2.5">
          {loadingNasa || !nasaWeather ? (
            <div className="text-center py-6 text-mars-subtle text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              Fetching authentic NASA InSight Martian weather telemetry...
            </div>
          ) : (
            <>
              <div className="bg-mars-dark/50 border border-mars-border p-2.5 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-mars-subtle uppercase font-semibold">Recorded Sol</div>
                  <div className="font-mono font-bold text-white text-sm">SOL {nasaWeather.latest_sol}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-mars-subtle">Season</div>
                  <div className="font-mono text-sky-300 font-bold text-xs capitalize">{nasaWeather.season.season} ({nasaWeather.season.northern_season})</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg">
                  <div className="text-[10px] text-mars-subtle font-semibold uppercase">Air Temperature</div>
                  <div className="font-mono text-white text-xs font-bold">{nasaWeather.air_temp.av}°C (Avg)</div>
                  <div className="text-[10px] text-mars-subtle font-mono">Min: {nasaWeather.air_temp.mn}°C • Max: {nasaWeather.air_temp.mx}°C</div>
                </div>

                <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg">
                  <div className="text-[10px] text-mars-subtle font-semibold uppercase">Atmospheric Pressure</div>
                  <div className="font-mono text-white text-xs font-bold">{nasaWeather.pressure.av} Pa</div>
                  <div className="text-[10px] text-mars-subtle font-mono">{(nasaWeather.pressure.av / 100).toFixed(2)} mbar (Min {nasaWeather.pressure.mn} Pa)</div>
                </div>

                <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg">
                  <div className="text-[10px] text-mars-subtle font-semibold uppercase">Horizontal Wind</div>
                  <div className="font-mono text-white text-xs font-bold">{nasaWeather.wind_speed.av} m/s</div>
                  <div className="text-[10px] text-mars-subtle font-mono">Max gust: {nasaWeather.wind_speed.mx} m/s</div>
                </div>

                <div className="bg-mars-dark/40 border border-mars-border p-2.5 rounded-lg">
                  <div className="text-[10px] text-mars-subtle font-semibold uppercase">Wind Direction</div>
                  <div className="font-mono text-white text-xs font-bold">{nasaWeather.wind_direction.compass_point} ({nasaWeather.wind_direction.compass_degrees}°)</div>
                  <div className="text-[10px] text-mars-subtle font-mono">Prevailing In-situ Vector</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 bg-mars-dark/30 p-2 rounded border border-mars-border/40 font-mono">
                Source: {nasaWeather.data_source} • Live NASA Open API
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
