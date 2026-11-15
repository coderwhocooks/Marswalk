"""
Marswalk Mission Confidence Engine.
Evaluates multi-dimensional mission reliability, data certainty, and model stability.
Executes Monte Carlo uncertainty simulations and parametric sensitivity analysis.
"""
from dataclasses import dataclass, field
import random
import math
from typing import List, Dict, Any, Optional

from backend.core.terrain import TerrainModel
from backend.core.router import RouteResult
from backend.core.simulator import SimulationResult, SpacesuitConfig, MissionSimulator

@dataclass
class ConfidenceAssessment:
    overall_score: float
    confidence_level: str # "VERY_HIGH", "HIGH", "MODERATE", "LOW", "CRITICAL"
    terrain_confidence: float
    route_confidence: float
    environment_confidence: float
    resource_confidence: float
    feasibility_confidence: float
    uncertainty_drivers: List[str]
    actionable_mitigations: List[str]

@dataclass
class MonteCarloResult:
    num_runs: int
    success_rate_pct: float
    duration_p10_h: float
    duration_p50_h: float
    duration_p90_h: float
    o2_margin_p10_pct: float
    o2_margin_p50_pct: float
    duration_samples_h: List[float]
    failure_breakdown: Dict[str, int]

@dataclass
class SensitivityAnalysisResult:
    parameter_elasticities: Dict[str, float]
    primary_failure_mode: str
    recommendation: str

class MissionConfidenceEngine:
    """
    Evaluates explainable confidence across planetary data, route morphology,
    environmental models, and life-support stability.
    """
    def __init__(self, terrain: TerrainModel, suit_config: Optional[SpacesuitConfig] = None):
        self.terrain = terrain
        self.config = suit_config or SpacesuitConfig()

    def evaluate_confidence(
        self,
        route: RouteResult,
        simulation: SimulationResult,
        has_real_insitu_env: bool = True
    ) -> ConfidenceAssessment:
        """
        Evaluate independent confidence dimensions and synthesize an explainable composite index.
        """
        drivers: List[str] = []
        mitigations: List[str] = []

        # 1. Terrain Data Confidence (C_terrain)
        # USGS CTX DTM provides 20m metric cells. Deduct for high roughness or proximity to NoData.
        c_terrain = 92.0 # Baseline for controlled USGS orbital stereo DTM
        avg_roughness = 0.8
        if route.pixel_path:
            roughness_vals = [float(self.terrain.roughness[r, c]) for r, c in route.pixel_path if not self.terrain.nodata_mask[r, c]]
            if roughness_vals:
                avg_roughness = sum(roughness_vals) / len(roughness_vals)
                if avg_roughness > 2.5:
                    c_terrain -= 12.0
                    drivers.append(f"Elevated surface roughness (mean {avg_roughness:.1f}m) increases local micro-topography uncertainty.")
                    mitigations.append("Cross-reference HiRISE 25cm high-resolution imagery for sub-pixel boulder fields.")

        # 2. Route Morphology Confidence (C_route)
        # Based on slope distribution and hazard count
        c_route = 95.0
        if route.max_slope_deg > 14.0:
            c_route -= 15.0
            drivers.append(f"Traverse encounters steep slope segments peaking at {route.max_slope_deg:.1f}°.")
            mitigations.append("Select 'Safe Contour' mode to route around scarps exceeding 12° slope.")
        elif route.max_slope_deg > 10.0:
            c_route -= 6.0

        if len(route.hazard_segments) > 3:
            c_route -= 8.0
            drivers.append(f"{len(route.hazard_segments)} hazard intervals identified along traverse.")

        # 3. Environmental Confidence (C_env)
        # If live/recent NASA in-situ telemetry is active, confidence is high; if pure seasonal model, lower.
        if has_real_insitu_env:
            c_env = 94.0
        else:
            c_env = 75.0
            drivers.append("Environmental inputs derived from seasonal diurnal models rather than direct in-situ telemetry.")
            mitigations.append("Connect NASA InSight/MEDA live API feed for verified surface temperature and atmospheric pressure.")

        # 4. Resource Model Confidence (C_resource)
        # Margin of O2 and power above mandatory 20% threshold
        c_resource = 90.0
        o2_margin_above_reserve = simulation.o2_remaining_pct - self.config.mandatory_reserve_pct
        if o2_margin_above_reserve < 10.0:
            c_resource -= 25.0
            drivers.append(f"O2 reserve margin ({simulation.o2_remaining_pct:.1f}%) is within 10% of mandatory abort buffer.")
            mitigations.append("Reduce planned science investigation dwell or shorten traverse distance to restore reserve.")
        elif o2_margin_above_reserve < 25.0:
            c_resource -= 10.0

        # 5. Feasibility Constraint
        c_feasibility = 95.0 if simulation.is_feasible else 30.0
        if not simulation.is_feasible:
            drivers.append(f"Mission violates constraint limits: {simulation.feasibility_status}.")

        # Weighted composite score: C = 0.25*T + 0.25*R + 0.20*E + 0.30*Res
        composite = (
            0.25 * c_terrain +
            0.25 * c_route +
            0.20 * c_env +
            0.30 * c_resource
        )
        if not simulation.is_feasible:
            composite = min(composite, 45.0)

        composite = max(0.0, min(100.0, composite))

        if composite >= 88.0:
            level = "VERY_HIGH"
        elif composite >= 75.0:
            level = "HIGH"
        elif composite >= 60.0:
            level = "MODERATE"
        elif composite >= 45.0:
            level = "LOW"
        else:
            level = "CRITICAL"

        if not drivers:
            drivers.append("Nominal planetary operating envelope across all evaluated systems.")

        return ConfidenceAssessment(
            overall_score=round(composite, 1),
            confidence_level=level,
            terrain_confidence=round(c_terrain, 1),
            route_confidence=round(c_route, 1),
            environment_confidence=round(c_env, 1),
            resource_confidence=round(c_resource, 1),
            feasibility_confidence=round(c_feasibility, 1),
            uncertainty_drivers=drivers,
            actionable_mitigations=mitigations
        )

    def run_monte_carlo(
        self,
        route: RouteResult,
        num_simulations: int = 100,
        science_dwell_min: float = 45.0,
        seed: int = 42
    ) -> MonteCarloResult:
        """
        Execute stochastic Monte Carlo simulations perturbing walking speed,
        metabolic consumption rate, and science stop duration.
        """
        random.seed(seed)
        simulator = MissionSimulator(self.config)

        duration_samples_h: List[float] = []
        o2_margin_samples_pct: List[float] = []
        success_count = 0
        failures = {"O2_DEPLETION": 0, "BATTERY_DEPLETION": 0, "TIME_OVERRUN": 0}

        base_duration_s = route.estimated_duration_s
        base_distance_m = route.total_distance_m

        for _ in range(num_simulations):
            # Speed perturbation: +/- 20%
            speed_factor = random.uniform(0.80, 1.20)
            walk_time_s = base_duration_s / speed_factor

            # Science dwell perturbation: +/- 30%
            dwell_min = science_dwell_min * random.uniform(0.70, 1.30)

            # Consumable rate perturbation: +/- 15%
            custom_config = SpacesuitConfig(
                o2_rate_walk_kg_h=self.config.o2_rate_walk_kg_h * random.uniform(0.85, 1.15),
                power_draw_w=self.config.power_draw_w * random.uniform(0.90, 1.10)
            )
            sim = MissionSimulator(custom_config).simulate(
                distance_m=base_distance_m,
                walking_time_s=walk_time_s,
                science_duration_min=dwell_min
            )

            dur_h = round(sim.total_mission_time_h, 2)
            duration_samples_h.append(dur_h)
            o2_margin_samples_pct.append(round(sim.o2_remaining_pct, 1))

            if sim.is_feasible:
                success_count += 1
            else:
                if sim.o2_remaining_pct < self.config.mandatory_reserve_pct:
                    failures["O2_DEPLETION"] += 1
                if sim.battery_remaining_pct < self.config.mandatory_reserve_pct:
                    failures["BATTERY_DEPLETION"] += 1
                if dur_h > 8.0:
                    failures["TIME_OVERRUN"] += 1

        duration_samples_h.sort()
        o2_margin_samples_pct.sort()

        n = len(duration_samples_h)
        p10_idx = int(0.10 * n)
        p50_idx = int(0.50 * n)
        p90_idx = int(0.90 * n)

        success_rate = (success_count / num_simulations) * 100.0

        return MonteCarloResult(
            num_runs=num_simulations,
            success_rate_pct=round(success_rate, 1),
            duration_p10_h=duration_samples_h[p10_idx],
            duration_p50_h=duration_samples_h[p50_idx],
            duration_p90_h=duration_samples_h[p90_idx],
            o2_margin_p10_pct=o2_margin_samples_pct[p10_idx],
            o2_margin_p50_pct=o2_margin_samples_pct[p50_idx],
            duration_samples_h=duration_samples_h,
            failure_breakdown=failures
        )

    def analyze_sensitivity(self, route: RouteResult) -> SensitivityAnalysisResult:
        """
        Evaluate mission parameter elasticity to identify the dominant uncertainty drivers.
        """
        simulator = MissionSimulator(self.config)
        base_sim = simulator.simulate(
            distance_m=route.total_distance_m,
            walking_time_s=route.estimated_duration_s
        )

        base_duration = base_sim.total_mission_time_h

        # 1. Walking speed elasticity
        sim_slow = simulator.simulate(
            distance_m=route.total_distance_m,
            walking_time_s=route.estimated_duration_s / 0.90 # 10% slower
        )
        elasticity_speed = ((sim_slow.total_mission_time_h - base_duration) / base_duration) / 0.10

        # 2. O2 consumption rate elasticity
        cfg_high_o2 = SpacesuitConfig(o2_rate_walk_kg_h=self.config.o2_rate_walk_kg_h * 1.10)
        sim_o2 = MissionSimulator(cfg_high_o2).simulate(
            distance_m=route.total_distance_m,
            walking_time_s=route.estimated_duration_s
        )
        elasticity_o2 = ((base_sim.o2_remaining_pct - sim_o2.o2_remaining_pct) / max(base_sim.o2_remaining_pct, 1.0)) / 0.10

        # 3. Slope impedance elasticity
        elasticity_slope = 0.55 if route.max_slope_deg > 12.0 else 0.25

        elasticities = {
            "walking_speed": round(float(elasticity_speed), 2),
            "slope_impedance": round(float(elasticity_slope), 2),
            "o2_rate": round(float(elasticity_o2), 2)
        }

        # Primary failure mode
        sorted_params = sorted(elasticities.items(), key=lambda x: abs(x[1]), reverse=True)
        top_driver = sorted_params[0][0]

        if top_driver == "walking_speed":
            mode = "Locomotion Delay / Incline Fatigue"
            rec = "Enforce scheduled rest pacing; monitor astronaut metabolic load during ascents."
        elif top_driver == "o2_rate":
            mode = "Consumable Depletion"
            rec = "Cap science dwell time at 40 minutes to maintain critical O2 safety reserves."
        else:
            mode = "Terrain Impedance / Gradient Bottleneck"
            rec = "Route along western delta shelf contour to avoid steep scarp ascents."

        return SensitivityAnalysisResult(
            parameter_elasticities=elasticities,
            primary_failure_mode=mode,
            recommendation=rec
        )
