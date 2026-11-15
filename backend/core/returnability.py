"""
Marswalk Returnability Intelligence Engine.
Evaluates continuous emergency return capability from any point along a Martian traverse,
calculates independent reverse escape trajectories, locates the Point of No Return,
and provides dynamic emergency event re-planning.
"""
from enum import Enum
from dataclasses import dataclass, field
import math
from typing import List, Dict, Any, Optional, Tuple

from backend.core.terrain import TerrainModel
from backend.core.router import MartianAStarRouter, RouteResult
from backend.core.simulator import SpacesuitConfig

class ReturnabilityStatus(str, Enum):
    FEASIBLE = "FEASIBLE"
    FEASIBLE_REDUCED_CONTINGENCY = "FEASIBLE_REDUCED_CONTINGENCY"
    CONSTRAINED = "CONSTRAINED"
    INFEASIBLE = "INFEASIBLE"
    UNKNOWN = "UNKNOWN"

@dataclass
class ReturnCheckpoint:
    step_index: int
    lon: float
    lat: float
    outbound_elapsed_s: float
    return_distance_m: float
    return_duration_s: float
    o2_return_required_kg: float
    battery_return_required_wh: float
    water_return_required_kg: float
    remaining_o2_margin_pct: float
    status: ReturnabilityStatus

@dataclass
class RouteReturnabilityEvaluation:
    overall_status: ReturnabilityStatus
    checkpoints: List[ReturnCheckpoint]
    point_of_no_return_idx: int
    point_of_no_return_lonlat: Optional[Tuple[float, float]]
    min_return_margin_pct: float
    preferred_return_route: Optional[RouteResult]
    limiting_resource: str
    summary: str

@dataclass
class EmergencyAssessment:
    action_recommendation: str  # "CONTINUE", "REPLAN", "RETURN_NOW", "ABORT_DIRECT"
    urgency_level: str          # "NOMINAL", "ADVISORY", "WARNING", "CRITICAL"
    reasoning: List[str]
    emergency_return_route: Optional[RouteResult]
    required_return_time_s: float
    estimated_o2_used_kg: float
    projected_final_o2_reserve_pct: float

class ReturnabilityEngine:
    """
    Continuous return capability evaluation and emergency recovery path planner.
    """
    def __init__(
        self,
        terrain: TerrainModel,
        router: MartianAStarRouter,
        spacesuit_config: Optional[SpacesuitConfig] = None
    ):
        self.terrain = terrain
        self.router = router
        self.config = spacesuit_config or SpacesuitConfig()

    def calculate_reverse_route(
        self,
        current_lon: float,
        current_lat: float,
        habitat_lon: float,
        habitat_lat: float,
        mode: str = "safe"
    ) -> Optional[RouteResult]:
        """
        Compute an independent reverse evacuation route back to habitat base.
        Calculates terrain cost and slope direction from current position towards habitat.
        """
        return self.router.plan_lonlat_route(
            start_lon=current_lon,
            start_lat=current_lat,
            goal_lon=habitat_lon,
            goal_lat=habitat_lat,
            mode=mode,
            max_slope_deg=22.0 # Allow slightly higher slope tolerance for emergency return
        )

    def evaluate_route_returnability(
        self,
        outbound_route: RouteResult,
        habitat_lon: float,
        habitat_lat: float,
        o2_capacity_kg: Optional[float] = None,
        battery_capacity_wh: Optional[float] = None,
        water_capacity_kg: Optional[float] = None,
        sample_step: int = 5
    ) -> RouteReturnabilityEvaluation:
        """
        Evaluate return feasibility across discrete intervals along the proposed outbound route.
        """
        o2_cap = o2_capacity_kg or self.config.o2_capacity_kg
        batt_cap = battery_capacity_wh or self.config.battery_capacity_wh
        water_cap = water_capacity_kg or self.config.cooling_water_capacity_kg

        coords = outbound_route.coords_lonlat
        if not coords:
            return RouteReturnabilityEvaluation(
                overall_status=ReturnabilityStatus.UNKNOWN,
                checkpoints=[],
                point_of_no_return_idx=-1,
                point_of_no_return_lonlat=None,
                min_return_margin_pct=0.0,
                preferred_return_route=None,
                limiting_resource="None",
                summary="Empty route"
            )

        checkpoints: List[ReturnCheckpoint] = []
        point_of_no_return_idx = len(coords) - 1
        pnr_lonlat = coords[-1]
        min_margin = 100.0
        overall_status = ReturnabilityStatus.FEASIBLE

        # Outbound time progression
        outbound_step_time = outbound_route.estimated_duration_s / max(len(coords) - 1, 1)

        # Sample checkpoints along outbound traverse
        step_indices = list(range(0, len(coords), max(sample_step, 1)))
        if (len(coords) - 1) not in step_indices:
            step_indices.append(len(coords) - 1)

        preferred_return = None

        for idx in step_indices:
            lon, lat = coords[idx]
            elapsed_outbound_s = idx * outbound_step_time

            # Outbound consumables used so far
            outbound_h = elapsed_outbound_s / 3600.0
            o2_used_outbound = outbound_h * self.config.o2_rate_walk_kg_h
            batt_used_outbound = outbound_h * self.config.power_draw_w
            water_used_outbound = outbound_h * self.config.cooling_water_rate_kg_h

            # Calculate return route from this checkpoint to habitat
            rev_route = self.calculate_reverse_route(lon, lat, habitat_lon, habitat_lat)
            if idx == len(coords) - 1:
                preferred_return = rev_route

            if not rev_route:
                checkpoints.append(ReturnCheckpoint(
                    step_index=idx,
                    lon=lon,
                    lat=lat,
                    outbound_elapsed_s=round(elapsed_outbound_s, 1),
                    return_distance_m=0.0,
                    return_duration_s=0.0,
                    o2_return_required_kg=0.0,
                    battery_return_required_wh=0.0,
                    water_return_required_kg=0.0,
                    remaining_o2_margin_pct=0.0,
                    status=ReturnabilityStatus.UNKNOWN
                ))
                continue

            return_h = rev_route.estimated_duration_s / 3600.0
            o2_return = return_h * self.config.o2_rate_walk_kg_h
            batt_return = return_h * self.config.power_draw_w
            water_return = return_h * self.config.cooling_water_rate_kg_h

            total_o2_used = o2_used_outbound + o2_return
            o2_remaining = max(o2_cap - total_o2_used, 0.0)
            margin_pct = (o2_remaining / o2_cap) * 100.0

            min_margin = min(min_margin, margin_pct)

            # Feasibility thresholds
            if margin_pct >= self.config.mandatory_reserve_pct:
                ckpt_status = ReturnabilityStatus.FEASIBLE
            elif margin_pct >= (self.config.mandatory_reserve_pct * 0.6):
                ckpt_status = ReturnabilityStatus.FEASIBLE_REDUCED_CONTINGENCY
            elif margin_pct > 0.0:
                ckpt_status = ReturnabilityStatus.CONSTRAINED
            else:
                ckpt_status = ReturnabilityStatus.INFEASIBLE

            if ckpt_status in [ReturnabilityStatus.CONSTRAINED, ReturnabilityStatus.INFEASIBLE] and point_of_no_return_idx == len(coords) - 1:
                point_of_no_return_idx = idx
                pnr_lonlat = (lon, lat)

            checkpoints.append(ReturnCheckpoint(
                step_index=idx,
                lon=lon,
                lat=lat,
                outbound_elapsed_s=round(elapsed_outbound_s, 1),
                return_distance_m=round(rev_route.total_distance_m, 1),
                return_duration_s=round(rev_route.estimated_duration_s, 1),
                o2_return_required_kg=round(o2_return, 3),
                battery_return_required_wh=round(batt_return, 1),
                water_return_required_kg=round(water_return, 2),
                remaining_o2_margin_pct=round(margin_pct, 1),
                status=ckpt_status
            ))

        # Determine overall evaluation status
        if min_margin < 0.1:
            overall_status = ReturnabilityStatus.INFEASIBLE
        elif min_margin < self.config.mandatory_reserve_pct:
            overall_status = ReturnabilityStatus.CONSTRAINED
        elif min_margin < (self.config.mandatory_reserve_pct + 10.0):
            overall_status = ReturnabilityStatus.FEASIBLE_REDUCED_CONTINGENCY
        else:
            overall_status = ReturnabilityStatus.FEASIBLE

        summary = f"Returnability {overall_status.value}: Minimum reserve margin {min_margin:.1f}% along traverse."

        return RouteReturnabilityEvaluation(
            overall_status=overall_status,
            checkpoints=checkpoints,
            point_of_no_return_idx=point_of_no_return_idx,
            point_of_no_return_lonlat=pnr_lonlat,
            min_return_margin_pct=round(min_margin, 1),
            preferred_return_route=preferred_return,
            limiting_resource="Oxygen Reserve",
            summary=summary
        )

    def assess_emergency_event(
        self,
        current_lon: float,
        current_lat: float,
        habitat_lon: float,
        habitat_lat: float,
        speed_factor: float = 1.0,
        remaining_o2_kg: float = 0.8,
        remaining_battery_wh: float = 600.0,
        remaining_water_kg: float = 2.5
    ) -> EmergencyAssessment:
        """
        Evaluate emergency return when an off-nominal event occurs.
        """
        # Calculate fastest escape route
        route = self.calculate_reverse_route(current_lon, current_lat, habitat_lon, habitat_lat, mode="safe")
        if not route:
            return EmergencyAssessment(
                action_recommendation="ABORT_DIRECT",
                urgency_level="CRITICAL",
                reasoning=["No viable escape corridor back to base. Direct extraction required."],
                emergency_return_route=None,
                required_return_time_s=0.0,
                estimated_o2_used_kg=0.0,
                projected_final_o2_reserve_pct=0.0
            )

        adjusted_duration_s = route.estimated_duration_s / max(speed_factor, 0.1)
        hours = adjusted_duration_s / 3600.0

        o2_needed = hours * self.config.o2_rate_walk_kg_h
        final_o2 = max(remaining_o2_kg - o2_needed, 0.0)
        final_o2_pct = (final_o2 / self.config.o2_capacity_kg) * 100.0

        reasoning = []
        if speed_factor < 0.75:
            reasoning.append(f"Astronaut mobility impaired: walking velocity scaled to {int(speed_factor * 100)}%.")

        if final_o2_pct < self.config.mandatory_reserve_pct:
            action = "RETURN_NOW"
            urgency = "WARNING" if final_o2_pct > 10.0 else "CRITICAL"
            reasoning.append(f"Projected post-return O2 margin ({final_o2_pct:.1f}%) is below mandatory {self.config.mandatory_reserve_pct}% threshold.")
        elif speed_factor < 0.6:
            action = "REPLAN"
            urgency = "ADVISORY"
            reasoning.append("Sustained mobility deficit requires aborting secondary science targets.")
        else:
            action = "CONTINUE"
            urgency = "NOMINAL"
            reasoning.append(f"Return corridor clear; projected reserve margin {final_o2_pct:.1f}%.")

        return EmergencyAssessment(
            action_recommendation=action,
            urgency_level=urgency,
            reasoning=reasoning,
            emergency_return_route=route,
            required_return_time_s=round(adjusted_duration_s, 1),
            estimated_o2_used_kg=round(o2_needed, 3),
            projected_final_o2_reserve_pct=round(final_o2_pct, 1)
        )
