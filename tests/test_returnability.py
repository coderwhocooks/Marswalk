"""
Unit tests for Returnability Intelligence Engine.
"""
import pytest
from backend.core.terrain import TerrainModel
from backend.core.router import MartianAStarRouter
from backend.core.returnability import ReturnabilityEngine, ReturnabilityStatus

DTM_PATH = "backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"

@pytest.fixture
def terrain():
    return TerrainModel.from_geotiff(DTM_PATH).downsample(2)

@pytest.fixture
def returnability_engine(terrain):
    router = MartianAStarRouter(terrain)
    return ReturnabilityEngine(terrain=terrain, router=router)

def test_reverse_route_calculation(returnability_engine):
    base_lon, base_lat = 77.4508, 18.4447   # Octavia E. Butler Base
    dest_lon, dest_lat = 77.4060, 18.4350   # Hawksbill Gap

    rev_plan = returnability_engine.calculate_reverse_route(
        current_lon=dest_lon,
        current_lat=dest_lat,
        habitat_lon=base_lon,
        habitat_lat=base_lat
    )
    assert rev_plan is not None
    assert rev_plan.total_distance_m > 0.0
    assert rev_plan.estimated_duration_s > 0.0
    assert len(rev_plan.coords_lonlat) > 2
    # Check that route terminates at habitat
    end_lon, end_lat = rev_plan.coords_lonlat[-1]
    assert abs(end_lon - base_lon) < 0.01
    assert abs(end_lat - base_lat) < 0.01

def test_returnability_evaluation_along_route(returnability_engine):
    base_lon, base_lat = 77.4508, 18.4447
    dest_lon, dest_lat = 77.4060, 18.4350

    # Plan outbound route first
    outbound = returnability_engine.router.plan_lonlat_route(
        start_lon=base_lon,
        start_lat=base_lat,
        goal_lon=dest_lon,
        goal_lat=dest_lat
    )
    assert outbound is not None

    evaluation = returnability_engine.evaluate_route_returnability(
        outbound_route=outbound,
        habitat_lon=base_lon,
        habitat_lat=base_lat,
        o2_capacity_kg=1.2,
        battery_capacity_wh=1000.0,
        water_capacity_kg=4.0
    )
    assert evaluation is not None
    assert len(evaluation.checkpoints) > 0
    assert evaluation.overall_status in [
        ReturnabilityStatus.FEASIBLE,
        ReturnabilityStatus.FEASIBLE_REDUCED_CONTINGENCY,
        ReturnabilityStatus.CONSTRAINED,
        ReturnabilityStatus.INFEASIBLE
    ]
    assert evaluation.point_of_no_return_idx >= 0
    assert evaluation.min_return_margin_pct >= 0.0

def test_emergency_condition_response(returnability_engine):
    base_lon, base_lat = 77.4508, 18.4447
    curr_lon, curr_lat = 77.4200, 18.4400

    # Simulate sudden 50% mobility loss
    emergency = returnability_engine.assess_emergency_event(
        current_lon=curr_lon,
        current_lat=curr_lat,
        habitat_lon=base_lon,
        habitat_lat=base_lat,
        speed_factor=0.5,
        remaining_o2_kg=0.45,
        remaining_battery_wh=400.0,
        remaining_water_kg=1.8
    )
    assert emergency is not None
    assert emergency.action_recommendation in ["CONTINUE", "REPLAN", "RETURN_NOW", "ABORT_DIRECT"]
    assert emergency.emergency_return_route is not None
    assert len(emergency.reasoning) > 0
