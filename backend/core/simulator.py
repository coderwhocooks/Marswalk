"""
Marswalk Astronaut Mission Feasibility Simulator.
Calculates extravehicular activity (EVA) timeline breakdown, life-support consumable
drawdown (Oxygen, Battery Energy, Sublimator Cooling Water), and safety reserve margins.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional

@dataclass
class SpacesuitConfig:
    """Configurable spacesuit life support parameters based on NASA EMU/xEMU engineering models."""
    o2_capacity_kg: float = 1.20              # Usable primary O2 supply
    battery_capacity_wh: float = 1000.0       # Usable battery capacity
    cooling_water_capacity_kg: float = 4.0    # Usable sublimator/evaporator water
    mandatory_reserve_pct: float = 20.0       # Minimum reserve threshold (abort limit)
    
    # Consumption rates
    o2_rate_walk_kg_h: float = 0.082          # Elevated metabolic rate during walking/climbing
    o2_rate_rest_kg_h: float = 0.052          # Nominal stationary science rate
    power_draw_w: float = 175.0               # Suit avionics, telemetry, scrubber fan, bio-monitors
    cooling_water_rate_kg_h: float = 0.45     # Sublimator heat rejection rate in Mars daylight

@dataclass
class SimulationResult:
    is_feasible: bool
    feasibility_status: str                   # "FEASIBLE", "MARGINAL", "INFEASIBLE"
    total_mission_time_h: float
    walk_time_h: float
    science_time_h: float
    nav_check_time_h: float
    contingency_time_h: float
    
    # Consumables usage and reserves
    o2_used_kg: float
    o2_remaining_kg: float
    o2_remaining_pct: float
    
    battery_used_wh: float
    battery_remaining_wh: float
    battery_remaining_pct: float
    
    cooling_water_used_kg: float
    cooling_water_remaining_kg: float
    cooling_water_remaining_pct: float
    
    limiting_resource: str
    bottlenecks: List[str] = field(default_factory=list)
    actionable_recommendations: List[str] = field(default_factory=list)

class MissionSimulator:
    """
    Simulates astronaut EVA mission timelines and life-support resource consumption.
    """
    def __init__(self, config: Optional[SpacesuitConfig] = None):
        self.config = config or SpacesuitConfig()

    def simulate(
        self,
        distance_m: float,
        walking_time_s: float,
        science_duration_min: float = 45.0,
        contingency_pct: float = 15.0,
        nav_checks_min: float = 15.0
    ) -> SimulationResult:
        """
        Run the deterministic consumables and timeline calculation.
        """
        walk_h = max(walking_time_s / 3600.0, 0.0)
        science_h = max(science_duration_min / 60.0, 0.0)
        nav_h = max(nav_checks_min / 60.0, 0.0)

        nominal_duration_h = walk_h + science_h + nav_h
        contingency_h = nominal_duration_h * (contingency_pct / 100.0)
        total_mission_h = nominal_duration_h + contingency_h

        # Consumables drawdown calculation
        # O2: Walk time at high metabolic rate, rest/science/contingency at basal rate
        o2_used = (walk_h * self.config.o2_rate_walk_kg_h +
                   (science_h + nav_h + contingency_h) * self.config.o2_rate_rest_kg_h)
        o2_remain = max(self.config.o2_capacity_kg - o2_used, 0.0)
        o2_pct = (o2_remain / self.config.o2_capacity_kg) * 100.0

        # Battery Power
        battery_used = total_mission_h * self.config.power_draw_w
        battery_remain = max(self.config.battery_capacity_wh - battery_used, 0.0)
        battery_pct = (battery_remain / self.config.battery_capacity_wh) * 100.0

        # Cooling Water
        water_used = total_mission_h * self.config.cooling_water_rate_kg_h
        water_remain = max(self.config.cooling_water_capacity_kg - water_used, 0.0)
        water_pct = (water_remain / self.config.cooling_water_capacity_kg) * 100.0

        # Feasibility assessment
        bottlenecks = []
        recommendations = []

        res_dict = {
            "Oxygen": o2_pct,
            "Battery": battery_pct,
            "Cooling Water": water_pct
        }
        limiting_res = min(res_dict, key=res_dict.get)
        min_pct = res_dict[limiting_res]

        if min_pct <= 0.0:
            status = "INFEASIBLE"
            is_feasible = False
        elif min_pct < self.config.mandatory_reserve_pct:
            status = "MARGINAL"
            is_feasible = False
        else:
            status = "FEASIBLE"
            is_feasible = True

        for name, pct in res_dict.items():
            if pct <= 0.0:
                bottlenecks.append(f"{name} completely exhausted before mission completion ({pct:.1f}%).")
            elif pct < self.config.mandatory_reserve_pct:
                bottlenecks.append(
                    f"{name} reserves fall to {pct:.1f}%, violating the {self.config.mandatory_reserve_pct}% mandatory safety abort threshold."
                )

        if not is_feasible:
            if min_pct <= 0.0:
                recommendations.append("Mission duration exceeds maximum allowable suit life-support endurance.")
            if science_h > 0.5:
                recommendations.append(f"Reduce scientific target dwell time by {round((1.0 - min_pct/self.config.mandatory_reserve_pct)*science_duration_min*0.6)} minutes.")
            if distance_m > 3000.0:
                recommendations.append("Select an alternative closer staging site or an intermediate exploration target.")
            recommendations.append("Consider deploying a secondary pressurized rover or logistics support asset.")

        return SimulationResult(
            is_feasible=is_feasible,
            feasibility_status=status,
            total_mission_time_h=round(total_mission_h, 2),
            walk_time_h=round(walk_h, 2),
            science_time_h=round(science_h, 2),
            nav_check_time_h=round(nav_h, 2),
            contingency_time_h=round(contingency_h, 2),
            o2_used_kg=round(o2_used, 3),
            o2_remaining_kg=round(o2_remain, 3),
            o2_remaining_pct=round(o2_pct, 1),
            battery_used_wh=round(battery_used, 1),
            battery_remaining_wh=round(battery_remain, 1),
            battery_remaining_pct=round(battery_pct, 1),
            cooling_water_used_kg=round(water_used, 2),
            cooling_water_remaining_kg=round(water_remain, 2),
            cooling_water_remaining_pct=round(water_pct, 1),
            limiting_resource=limiting_res,
            bottlenecks=bottlenecks,
            actionable_recommendations=recommendations
        )
