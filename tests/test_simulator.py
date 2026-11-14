import pytest
from backend.core.simulator import MissionSimulator, SpacesuitConfig, SimulationResult

def test_nominal_short_mission_is_feasible():
    sim = MissionSimulator()
    # 2.5 km walk (~0.8 hours), 30 min science stop
    res = sim.simulate(
        distance_m=2500.0,
        walking_time_s=3000.0, # 50 mins
        science_duration_min=30.0,
        contingency_pct=15.0
    )
    assert isinstance(res, SimulationResult)
    assert res.is_feasible == True
    assert res.feasibility_status == "FEASIBLE"
    assert res.o2_remaining_pct > 50.0
    assert res.battery_remaining_pct > 50.0
    assert res.cooling_water_remaining_pct > 50.0

def test_overlength_mission_is_infeasible():
    sim = MissionSimulator()
    # Massive 25 km walk (8 hours walk) + 180 min science stop = > 11 hours
    res = sim.simulate(
        distance_m=25000.0,
        walking_time_s=28800.0, # 8 hours
        science_duration_min=180.0,
        contingency_pct=20.0
    )
    assert res.is_feasible == False
    assert res.feasibility_status == "INFEASIBLE"
    assert len(res.bottlenecks) > 0
    assert len(res.actionable_recommendations) > 0

def test_marginal_reserve_warning():
    # Tailor duration to consume between 80% and 100% of battery/O2
    sim = MissionSimulator(SpacesuitConfig(battery_capacity_wh=500.0))
    res = sim.simulate(
        distance_m=4000.0,
        walking_time_s=5400.0, # 1.5h
        science_duration_min=60.0,
        contingency_pct=15.0
    )
    # Total duration ~3.0h * 180W = 540Wh > 500Wh -> Infeasible or Marginal
    assert res.feasibility_status in ["MARGINAL", "INFEASIBLE"]
    assert any("Battery" in b for b in res.bottlenecks)
