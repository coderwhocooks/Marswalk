"""
Marswalk Human Mobility and Fatigue Estimator.
Biomechanically grounded locomotion modeling for suited astronauts in 0.38g Martian gravity.
Implements Santee-Minetti metabolic power calculation, slope impedance, fatigue accumulation,
and work-rest interval scheduling.
"""
from dataclasses import dataclass, field
import math
from typing import List, Dict, Any, Optional

MARS_GRAVITY = 3.72076  # m/s^2 (0.3794 of Earth standard gravity)
EARTH_GRAVITY = 9.80665 # m/s^2

@dataclass
class MobilitySegmentResult:
    distance_m: float
    slope_deg: float
    speed_ms: float
    duration_s: float
    metabolic_power_w: float
    work_joules: float
    fatigue_delta: float
    end_fatigue: float

@dataclass
class RestSchedule:
    step_index: int
    distance_along_route_m: float
    elapsed_time_s: float
    rest_duration_min: float
    fatigue_before_pct: float
    fatigue_after_pct: float
    reason: str

@dataclass
class MobilityProfile:
    total_distance_m: float
    total_walk_time_s: float
    total_rest_time_s: float
    total_elapsed_time_s: float
    avg_speed_ms: float
    avg_metabolic_power_w: float
    peak_metabolic_power_w: float
    total_energy_kcal: float
    peak_fatigue_pct: float
    fatigue_curve: List[float]
    speed_profile: List[float]
    power_profile: List[float]
    rest_stops: List[RestSchedule]

class MobilityEstimator:
    """
    Simulates astronaut physiological exertion, walking velocity, and fatigue
    across complex Martian terrain.
    """
    def __init__(
        self,
        astronaut_mass_kg: float = 80.0,
        suit_mass_kg: float = 120.0,
        nominal_flat_speed_ms: float = 0.85,
        fatigue_threshold_pct: float = 40.0
    ):
        self.astronaut_mass_kg = astronaut_mass_kg
        self.suit_mass_kg = suit_mass_kg
        self.total_mass_kg = astronaut_mass_kg + suit_mass_kg
        self.v0 = nominal_flat_speed_ms
        self.fatigue_threshold = fatigue_threshold_pct / 100.0

        # Physiological baseline parameters in 0.38g
        self.basal_power_w = 140.0          # Basal life-support metabolic rate in suit
        self.muscle_efficiency = 0.22       # Mechanical efficiency of human uphill locomotion
        self.gravity_ratio = MARS_GRAVITY / EARTH_GRAVITY

    def estimate_segment(
        self,
        distance_m: float,
        slope_deg: float,
        current_fatigue: float = 0.0
    ) -> MobilitySegmentResult:
        """
        Calculate travel speed, duration, metabolic rate, and fatigue increase
        over a single discrete terrain segment.
        """
        slope_rad = math.radians(slope_deg)
        gradient = math.tan(slope_rad)

        # 1. Tobler-Minetti Mars slope velocity
        slope_speed = max(self.v0 * math.exp(-3.5 * abs(gradient + 0.05)), 0.15)
        
        # 2. Fatigue degradation: fatigue can slow speed by up to 35%
        fatigue_clamped = min(max(current_fatigue, 0.0), 1.0)
        speed = max(slope_speed * (1.0 - 0.35 * fatigue_clamped), 0.12)
        duration_s = distance_m / speed

        # 3. Santee-Minetti metabolic power in 0.38g
        # Flat ground transport cost: ~1.22 J/(kg*m) in 0.38g
        flat_cost_per_m = 1.22 * self.total_mass_kg
        flat_walk_power = flat_cost_per_m * speed

        # Slope vertical lift power: m * g_mars * v_vertical / efficiency
        vert_speed = speed * math.sin(slope_rad)
        if vert_speed > 0:
            climb_power = (self.total_mass_kg * MARS_GRAVITY * vert_speed) / self.muscle_efficiency
        else:
            # Downhill braking: negative work burns some energy for deceleration
            climb_power = abs(vert_speed) * self.total_mass_kg * MARS_GRAVITY * 0.12

        total_power_w = self.basal_power_w + flat_walk_power + climb_power
        work_joules = total_power_w * duration_s

        # 4. Fatigue accumulation
        # In a 200 kg suit, sustained walking on gradients accumulates 15-25% fatigue per km
        exertion_factor = max(total_power_w / 280.0, 1.0)
        fatigue_rate_per_km = 0.18 * (exertion_factor ** 1.5)
        fatigue_delta = (distance_m / 1000.0) * fatigue_rate_per_km
        end_fatigue = min(fatigue_clamped + fatigue_delta, 1.0)

        return MobilitySegmentResult(
            distance_m=round(distance_m, 1),
            slope_deg=round(slope_deg, 2),
            speed_ms=round(speed, 3),
            duration_s=round(duration_s, 1),
            metabolic_power_w=round(total_power_w, 1),
            work_joules=round(work_joules, 1),
            fatigue_delta=round(fatigue_delta, 4),
            end_fatigue=round(end_fatigue, 4)
        )

    def evaluate_traverse(
        self,
        distances_m: List[float],
        slopes_deg: List[float]
    ) -> MobilityProfile:
        """
        Evaluate full mission traverse profile, calculating fatigue progression
        and scheduling mandatory physiological rest stops.
        """
        if not distances_m or len(distances_m) != len(slopes_deg):
            raise ValueError("distances_m and slopes_deg must have identical non-zero lengths")

        current_fatigue = 0.0
        elapsed_walk_time_s = 0.0
        elapsed_rest_time_s = 0.0
        distance_accum = 0.0
        total_joules = 0.0

        fatigue_curve: List[float] = []
        speed_profile: List[float] = []
        power_profile: List[float] = []
        rest_stops: List[RestSchedule] = []

        peak_power = 0.0
        peak_fatigue = 0.0

        for i, (dist, slope) in enumerate(zip(distances_m, slopes_deg)):
            seg = self.estimate_segment(dist, slope, current_fatigue)

            elapsed_walk_time_s += seg.duration_s
            distance_accum += dist
            total_joules += seg.work_joules
            current_fatigue = seg.end_fatigue

            peak_power = max(peak_power, seg.metabolic_power_w)
            peak_fatigue = max(peak_fatigue, current_fatigue)

            fatigue_curve.append(round(current_fatigue * 100.0, 1))
            speed_profile.append(round(seg.speed_ms, 2))
            power_profile.append(round(seg.metabolic_power_w, 1))

            # Rest scheduling: if fatigue exceeds threshold, schedule rest stop
            if current_fatigue >= self.fatigue_threshold:
                rest_min = 8.0 # 8 minute physiological recovery
                rest_s = rest_min * 60.0
                elapsed_rest_time_s += rest_s

                fatigue_before = current_fatigue * 100.0
                # Recovery reduces fatigue by ~55% of accumulated load
                current_fatigue = max(current_fatigue * 0.45, 0.05)
                fatigue_after = current_fatigue * 100.0

                rest_stops.append(RestSchedule(
                    step_index=i,
                    distance_along_route_m=round(distance_accum, 1),
                    elapsed_time_s=round(elapsed_walk_time_s + elapsed_rest_time_s, 1),
                    rest_duration_min=rest_min,
                    fatigue_before_pct=round(fatigue_before, 1),
                    fatigue_after_pct=round(fatigue_after, 1),
                    reason="Exceeded 40% fatigue threshold on sustained terrain gradient"
                ))

        total_distance = sum(distances_m)
        avg_speed = total_distance / elapsed_walk_time_s if elapsed_walk_time_s > 0 else 0.0
        avg_power = total_joules / elapsed_walk_time_s if elapsed_walk_time_s > 0 else 0.0
        total_kcal = total_joules / 4184.0

        return MobilityProfile(
            total_distance_m=round(total_distance, 1),
            total_walk_time_s=round(elapsed_walk_time_s, 1),
            total_rest_time_s=round(elapsed_rest_time_s, 1),
            total_elapsed_time_s=round(elapsed_walk_time_s + elapsed_rest_time_s, 1),
            avg_speed_ms=round(avg_speed, 2),
            avg_metabolic_power_w=round(avg_power, 1),
            peak_metabolic_power_w=round(peak_power, 1),
            total_energy_kcal=round(total_kcal, 1),
            peak_fatigue_pct=round(peak_fatigue * 100.0, 1),
            fatigue_curve=fatigue_curve,
            speed_profile=speed_profile,
            power_profile=power_profile,
            rest_stops=rest_stops
        )
