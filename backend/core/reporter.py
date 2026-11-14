"""
Marswalk Expedition Briefing & Report Generator.
Generates comprehensive, auditable mission dossiers combining route profiles,
geological target objectives, environmental assessments, and life-support budgets.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from backend.core.router import RouteResult
from backend.core.science import ScienceTarget
from backend.core.simulator import SimulationResult

class ExpeditionReporter:
    """
    Produces formatted expedition dossiers in JSON, Markdown, and HTML formats.
    """
    @staticmethod
    def generate_briefing(
        mission_id: str,
        crew_names: list[str],
        start_name: str,
        start_coords: tuple[float, float],
        target: Optional[ScienceTarget],
        route: RouteResult,
        simulation: SimulationResult,
        environment: Dict[str, Any],
        alternate_routes: Optional[Dict[str, RouteResult]] = None
    ) -> Dict[str, Any]:
        """
        Assemble the complete structured mission dossier.
        """
        elev_gain = 0.0
        elev_loss = 0.0
        for i in range(1, len(route.elevation_profile)):
            diff = route.elevation_profile[i] - route.elevation_profile[i - 1]
            if diff > 0:
                elev_gain += diff
            else:
                elev_loss += abs(diff)

        briefing = {
            "mission_metadata": {
                "mission_id": mission_id,
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                "crew": crew_names,
                "destination_body": "Mars",
                "region": "Jezero Crater",
                "geodetic_datum": "Mars 2000 Sphere (R = 3,396,190 m)",
                "projection": "Equirectangular (Eqc_latTs0_lon0)"
            },
            "traverse_plan": {
                "staging_point": {
                    "name": start_name,
                    "lon": start_coords[0],
                    "lat": start_coords[1]
                },
                "destination_point": {
                    "name": target.name if target else "Custom Exploration Coordinate",
                    "target_id": target.target_id if target else "CUSTOM-01",
                    "lon": target.lon if target else route.coords_lonlat[-1][0],
                    "lat": target.lat if target else route.coords_lonlat[-1][1]
                },
                "selected_route": {
                    "mode": route.mode,
                    "total_distance_km": round(route.total_distance_m / 1000.0, 2),
                    "walking_time_h": round(route.estimated_duration_s / 3600.0, 2),
                    "max_slope_deg": route.max_slope_deg,
                    "avg_slope_deg": route.avg_slope_deg,
                    "elevation_gain_m": round(elev_gain, 1),
                    "elevation_loss_m": round(elev_loss, 1),
                    "hazard_count": len(route.hazard_segments),
                    "waypoints_count": len(route.coords_lonlat)
                }
            },
            "science_objective": {
                "target_name": target.name if target else "N/A",
                "geological_unit": target.geological_unit if target else "N/A",
                "mineralogy": target.mineralogy if target else "N/A",
                "primary_objective": target.investigation_objective if target else "General reconnaissance",
                "supporting_instruments": target.supporting_instrument if target else "Orbital imagery",
                "product_provenance": target.product_identifier if target else "USGS / NASA"
            },
            "environmental_conditions": {
                "lmst_hour": environment.get("lmst_hour", 12.0),
                "surface_temperature_c": environment.get("surface_temp_c", -30.0),
                "atmospheric_temperature_c": environment.get("air_temp_c", -45.0),
                "pressure_pa": environment.get("pressure_pa", 720.0),
                "wind_speed_ms": environment.get("wind_speed_ms", 5.0),
                "dust_optical_depth": environment.get("dust_optical_depth", 0.42),
                "solar_irradiance_wm2": environment.get("solar_flux_wm2", 350.0),
                "accumulated_radiation_dose_msv": environment.get("radiation_dose_msv", 0.1)
            },
            "life_support_simulation": {
                "feasibility_status": simulation.feasibility_status,
                "is_feasible": simulation.is_feasible,
                "total_eva_time_h": simulation.total_mission_time_h,
                "walk_time_h": simulation.walk_time_h,
                "science_dwell_h": simulation.science_time_h,
                "contingency_h": simulation.contingency_time_h,
                "limiting_resource": simulation.limiting_resource,
                "oxygen_remaining_pct": simulation.o2_remaining_pct,
                "battery_remaining_pct": simulation.battery_remaining_pct,
                "cooling_water_remaining_pct": simulation.cooling_water_remaining_pct,
                "bottlenecks": simulation.bottlenecks,
                "actionable_recommendations": simulation.actionable_recommendations
            },
            "data_provenance": [
                {
                    "dataset": "USGS Jezero Crater 20m DTM",
                    "product_id": "JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0",
                    "mission_instrument": "MRO CTX stereo pairs processed by USGS",
                    "resolution": "20.0 m/pixel",
                    "spatial_coverage": "77.16°E - 77.70°E, 18.21°N - 18.72°N",
                    "url": "https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/"
                },
                {
                    "dataset": "NASA Mars Trek Jezero CTX Orthomosaic",
                    "product_id": "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0",
                    "mission_instrument": "MRO CTX (NASA Solar System Treks WMTS)",
                    "resolution": "6.0 m/pixel",
                    "url": "https://trek.nasa.gov/tiles/Mars/EQ/"
                },
                {
                    "dataset": "USGS Jezero Geological Map",
                    "product_id": "USGS Scientific Investigations Map 3464",
                    "mission_instrument": "USGS Astrogeology (1:75,000 scale)",
                    "resolution": "1:75,000 map scale",
                    "url": "https://doi.org/10.3133/sim3464"
                },
                {
                    "dataset": "Mars 2020 Environmental Sensor Records",
                    "product_id": "Perseverance MEDA PDS Archive",
                    "mission_instrument": "Perseverance Rover MEDA (Jezero Surface)",
                    "resolution": "In-situ point sensor",
                    "url": "https://pds-geosciences.wustl.edu/m2020/urn-nasa-pds-mars2020_meda/"
                }
            ],
            "disclaimer": "This expedition briefing is generated by the MARSWALK research demonstrator. Calculated traverse routes and consumable usage are based on empirical physical models and experimental engineering assumptions. They do not constitute operational safety certification for human spaceflight."
        }

        # Compare with alternatives if present
        if alternate_routes:
            briefing["route_comparison"] = {}
            for m_name, alt_route in alternate_routes.items():
                briefing["route_comparison"][m_name] = {
                    "distance_km": round(alt_route.total_distance_m / 1000.0, 2),
                    "walking_time_h": round(alt_route.estimated_duration_s / 3600.0, 2),
                    "max_slope_deg": alt_route.max_slope_deg,
                    "avg_slope_deg": alt_route.avg_slope_deg,
                    "hazard_count": len(alt_route.hazard_segments)
                }

        return briefing

    @staticmethod
    def to_markdown(briefing: Dict[str, Any]) -> str:
        """Convert structured briefing into a clean Markdown document."""
        meta = briefing["mission_metadata"]
        plan = briefing["traverse_plan"]
        sel = plan["selected_route"]
        sci = briefing["science_objective"]
        env = briefing["environmental_conditions"]
        lss = briefing["life_support_simulation"]

        lines = [
            f"# MARSWALK EXPEDITION BRIEFING — {meta['mission_id']}",
            f"**Generated:** {meta['timestamp_utc']} | **Region:** {meta['region']} | **Datum:** {meta['geodetic_datum']}",
            f"**Crew:** {', '.join(meta['crew'])}",
            "",
            "## 1. Traverse & Route Plan",
            f"- **Staging Location:** {plan['staging_point']['name']} ({plan['staging_point']['lat']:.4f}°N, {plan['staging_point']['lon']:.4f}°E)",
            f"- **Target Destination:** {plan['destination_point']['name']} ({plan['destination_point']['lat']:.4f}°N, {plan['destination_point']['lon']:.4f}°E)",
            f"- **Route Mode:** {sel['mode'].upper()} (Distance: {sel['total_distance_km']} km | Walking Time: {sel['walking_time_h']} h)",
            f"- **Terrain Gradient:** Avg Slope: {sel['avg_slope_deg']}° | Max Slope: {sel['max_slope_deg']}°",
            f"- **Vertical Relief:** Elevation Gain: +{sel['elevation_gain_m']} m | Loss: -{sel['elevation_loss_m']} m",
            f"- **Hazard Flags:** {sel['hazard_count']} slope/roughness warning segments identified",
            "",
            "## 2. Scientific Objective",
            f"- **Target:** {sci['target_name']}",
            f"- **Stratigraphic Unit:** {sci['geological_unit']}",
            f"- **Key Minerals:** {sci['mineralogy']}",
            f"- **Sampling Goal:** {sci['primary_objective']}",
            f"- **Heritage:** {sci['supporting_instruments']} ({sci['product_provenance']})",
            "",
            "## 3. Surface Environmental Conditions",
            f"- **Local Solar Time:** {env['lmst_hour']:.1f} LMST",
            f"- **Temperature:** Ground {env['surface_temperature_c']}°C | Air (1.5m) {env['atmospheric_temperature_c']}°C",
            f"- **Pressure:** {env['pressure_pa']} Pa | **Wind:** {env['wind_speed_ms']} m/s",
            f"- **Dust Tau:** {env['dust_optical_depth']} | **Downwelling Irradiance:** {env['solar_irradiance_wm2']} W/m²",
            f"- **Ionizing Radiation:** {env['accumulated_radiation_dose_msv']} mSv estimated EVA dose",
            "",
            "## 4. Life Support & Mission Feasibility",
            f"- **Overall Feasibility:** **{lss['feasibility_status']}** (Feasible: {lss['is_feasible']})",
            f"- **Total Planned Duration:** {lss['total_eva_time_h']} h (Walk: {lss['walk_time_h']} h, Science: {lss['science_dwell_h']} h, Contingency: {lss['contingency_h']} h)",
            f"- **Remaining Oxygen:** {lss['oxygen_remaining_pct']}%",
            f"- **Remaining Battery:** {lss['battery_remaining_pct']}%",
            f"- **Remaining Cooling Water:** {lss['cooling_water_remaining_pct']}%",
            f"- **Limiting Resource:** {lss['limiting_resource']}",
        ]

        if lss["bottlenecks"]:
            lines.append("")
            lines.append("### Safety Bottlenecks")
            for b in lss["bottlenecks"]:
                lines.append(f"- ⚠️ {b}")

        if lss["actionable_recommendations"]:
            lines.append("")
            lines.append("### Recommended Contingencies")
            for r in lss["actionable_recommendations"]:
                lines.append(f"- 💡 {r}")

        lines.extend([
            "",
            "## 5. Dataset Provenance",
            "| Dataset | Product Identifier | Resolution | Source / URL |",
            "|---|---|---|---|"
        ])
        for p in briefing["data_provenance"]:
            res = p.get('resolution', 'N/A')
            lines.append(f"| {p['dataset']} | {p['product_id']} | {res} | [{p['mission_instrument']}]({p['url']}) |")

        lines.extend([
            "",
            "> [!NOTE]",
            f"> {briefing['disclaimer']}"
        ])

        return "\n".join(lines)
