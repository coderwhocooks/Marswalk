"""
Unit tests for Human Mobility and Fatigue Estimator.
"""
import pytest
from backend.core.mobility import MobilityEstimator, MobilityProfile, RestSchedule

def test_mobility_flat_surface():
    estimator = MobilityEstimator()
    # 1000m on flat ground (slope 0 deg)
    result = estimator.estimate_segment(distance_m=1000.0, slope_deg=0.0, current_fatigue=0.0)
    assert result.duration_s > 0.0
    assert 0.7 <= result.speed_ms <= 1.0
    assert 250.0 <= result.metabolic_power_w <= 450.0
    assert result.fatigue_delta >= 0.0

def test_mobility_slope_cost():
    estimator = MobilityEstimator()
    # 500m on flat vs 500m on 15 deg incline
    flat = estimator.estimate_segment(distance_m=500.0, slope_deg=0.0, current_fatigue=0.0)
    climb = estimator.estimate_segment(distance_m=500.0, slope_deg=15.0, current_fatigue=0.0)
    
    # Climbing is slower and consumes more metabolic energy
    assert climb.speed_ms < flat.speed_ms
    assert climb.duration_s > flat.duration_s
    assert climb.metabolic_power_w > flat.metabolic_power_w
    assert climb.fatigue_delta > flat.fatigue_delta

def test_mobility_profile_and_rest_schedule():
    estimator = MobilityEstimator()
    distances = [100.0] * 20 # 2000m total
    slopes = [0.0, 2.0, 5.0, 10.0, 12.0, 8.0, 4.0, 0.0, 3.0, 6.0,
              12.0, 15.0, 8.0, 2.0, 0.0, 4.0, 8.0, 10.0, 5.0, 0.0]
    
    profile = estimator.evaluate_traverse(distances_m=distances, slopes_deg=slopes)
    assert profile.total_distance_m == 2000.0
    assert profile.total_walk_time_s > 0.0
    assert len(profile.fatigue_curve) == 20
    assert 0.0 <= profile.peak_fatigue_pct <= 100.0
    assert len(profile.rest_stops) > 0 # Long traverse on slopes requires scheduled rest
