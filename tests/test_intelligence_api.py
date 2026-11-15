"""
Integration tests for Advanced Intelligence Systems API routes.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_mobility_api():
    payload = {
        "distances_m": [100.0, 150.0, 200.0, 100.0],
        "slopes_deg": [2.0, 5.0, 8.0, 1.0],
        "astronaut_mass_kg": 80.0,
        "suit_mass_kg": 120.0
    }
    resp = client.post("/api/v1/mobility/estimate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_distance_m"] == 550.0
    assert data["total_walk_time_s"] > 0
    assert len(data["fatigue_curve"]) == 4

def test_returnability_api():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350
    }
    resp = client.post("/api/v1/returnability/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "overall_status" in data
    assert len(data["checkpoints"]) > 0
    assert data["min_return_margin_pct"] >= 0.0

def test_emergency_event_api():
    payload = {
        "current_lon": 77.4200,
        "current_lat": 18.4400,
        "habitat_lon": 77.4508,
        "habitat_lat": 18.4447,
        "speed_factor": 0.6,
        "remaining_o2_kg": 0.5
    }
    resp = client.post("/api/v1/returnability/emergency", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["action_recommendation"] in ["CONTINUE", "REPLAN", "RETURN_NOW", "ABORT_DIRECT"]
    assert len(data["reasoning"]) > 0

def test_confidence_api():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350,
        "science_dwell_min": 45.0
    }
    resp = client.post("/api/v1/confidence/evaluate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert 0.0 <= data["overall_score"] <= 100.0
    assert data["confidence_level"] in ["VERY_HIGH", "HIGH", "MODERATE", "LOW", "CRITICAL"]

def test_monte_carlo_api():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350,
        "num_simulations": 50
    }
    resp = client.post("/api/v1/confidence/monte-carlo", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["num_runs"] == 50
    assert 0.0 <= data["success_rate_pct"] <= 100.0

def test_sensitivity_api():
    resp = client.get("/api/v1/confidence/sensitivity?start_lon=77.4508&start_lat=18.4447&goal_lon=77.4060&goal_lat=18.4350")
    assert resp.status_code == 200
    data = resp.json()
    assert "walking_speed" in data["parameter_elasticities"]

def test_science_discovery_api():
    resp = client.get("/api/v1/science/discover?current_lon=77.4508&current_lat=18.4447&radius_m=8000")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3
    assert data[0]["scientific_value_density"] > 0

def test_science_tour_api():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "time_budget_h": 4.0,
        "dwell_per_stop_min": 30.0
    }
    resp = client.post("/api/v1/science/tour", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["stops"]) >= 1
    assert data["total_duration_h"] <= 4.0

def test_habitat_candidates_api():
    resp = client.get("/api/v1/habitat/candidates")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3
    assert data[0]["composite_suitability"] >= 70.0
