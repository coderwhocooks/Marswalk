"""
Unit tests for Mission Confidence Engine.
"""
import pytest
from backend.core.terrain import TerrainModel
from backend.core.router import MartianAStarRouter
from backend.core.simulator import MissionSimulator
from backend.core.confidence import MissionConfidenceEngine

DTM_PATH = "backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"

@pytest.fixture
def terrain():
    return TerrainModel.from_geotiff(DTM_PATH).downsample(2)

@pytest.fixture
def router(terrain):
    return MartianAStarRouter(terrain)

@pytest.fixture
def confidence_engine(terrain):
    return MissionConfidenceEngine(terrain)

def test_confidence_dimensions(confidence_engine, router):
    route = router.plan_lonlat_route(
        start_lon=77.4508,
        start_lat=18.4447,
        goal_lon=77.4060,
        goal_lat=18.4350
    )
    sim = MissionSimulator().simulate(
        distance_m=route.total_distance_m,
        walking_time_s=route.estimated_duration_s
    )

    assessment = confidence_engine.evaluate_confidence(
        route=route,
        simulation=sim,
        has_real_insitu_env=True
    )

    assert assessment is not None
    assert 0.0 <= assessment.overall_score <= 100.0
    assert 0.0 <= assessment.terrain_confidence <= 100.0
    assert 0.0 <= assessment.route_confidence <= 100.0
    assert 0.0 <= assessment.environment_confidence <= 100.0
    assert 0.0 <= assessment.resource_confidence <= 100.0
    assert len(assessment.uncertainty_drivers) >= 1
    assert assessment.confidence_level in ["VERY_HIGH", "HIGH", "MODERATE", "LOW", "CRITICAL"]

def test_monte_carlo_scenarios(confidence_engine, router):
    route = router.plan_lonlat_route(
        start_lon=77.4508,
        start_lat=18.4447,
        goal_lon=77.4060,
        goal_lat=18.4350
    )
    mc_result = confidence_engine.run_monte_carlo(
        route=route,
        num_simulations=100,
        science_dwell_min=45.0
    )

    assert mc_result is not None
    assert mc_result.num_runs == 100
    assert 0.0 <= mc_result.success_rate_pct <= 100.0
    assert mc_result.duration_p10_h <= mc_result.duration_p50_h <= mc_result.duration_p90_h
    assert mc_result.o2_margin_p10_pct <= mc_result.o2_margin_p50_pct
    assert len(mc_result.duration_samples_h) == 100

def test_sensitivity_analysis(confidence_engine, router):
    route = router.plan_lonlat_route(
        start_lon=77.4508,
        start_lat=18.4447,
        goal_lon=77.4060,
        goal_lat=18.4350
    )
    sensitivity = confidence_engine.analyze_sensitivity(route=route)
    assert sensitivity is not None
    assert "walking_speed" in sensitivity.parameter_elasticities
    assert "slope_impedance" in sensitivity.parameter_elasticities
    assert "o2_rate" in sensitivity.parameter_elasticities
    assert len(sensitivity.primary_failure_mode) > 0
