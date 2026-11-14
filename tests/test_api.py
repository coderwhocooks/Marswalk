import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_root_and_health():
    resp = client.get("/")
    assert resp.status_code == 200
    # Root either returns HTML (production frontend) or JSON info
    assert "MARSWALK" in resp.text or resp.json().get("project") == "MARSWALK"

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "healthy"

def test_get_datasets():
    resp = client.get("/api/v1/datasets")
    assert resp.status_code == 200
    datasets = resp.json()
    assert len(datasets) >= 4
    ids = [d["dataset_id"] for d in datasets]
    assert "USGS-JEZ-CTX-DTM-20M" in ids
    assert "NASA-TREK-JEZ-CTX-6M" in ids

def test_get_layers():
    resp = client.get("/api/v1/layers")
    assert resp.status_code == 200
    layers = resp.json()
    assert len(layers) >= 3
    layer_ids = [l["layer_id"] for l in layers]
    assert "nasa_jezero_ctx_wmts" in layer_ids

def test_get_coverage():
    resp = client.get("/api/v1/coverage")
    assert resp.status_code == 200
    cov = resp.json()
    assert "Jezero" in cov["region_name"]
    assert cov["bounds_lonlat"][0] < cov["bounds_lonlat"][2]
    assert cov["bounds_lonlat"][1] < cov["bounds_lonlat"][3]

def test_point_terrain_query():
    # Octavia Butler Landing site
    resp = client.post("/api/v1/terrain/point", json={"lon": 77.4508, "lat": 18.4447})
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_traversable"] == True
    assert data["elevation_m"] is not None
    assert -2600.0 < data["elevation_m"] < -2400.0

def test_get_science_targets():
    resp = client.get("/api/v1/science-targets")
    assert resp.status_code == 200
    targets = resp.json()
    assert len(targets) >= 6

    # Test ranking with position query
    ranked_resp = client.get("/api/v1/science-targets?current_lon=77.4508&current_lat=18.4447")
    assert ranked_resp.status_code == 200
    ranked = ranked_resp.json()
    assert ranked[0]["composite_score"] is not None

def test_get_environment():
    resp = client.get("/api/v1/environment?lmst_hour=13.5&duration_hours=4.0")
    assert resp.status_code == 200
    env = resp.json()
    assert "surface_temp_c" in env
    assert "pressure_pa" in env
    assert "radiation_dose_msv" in env

def test_route_plan_endpoint():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350,
        "mode": "safe",
        "max_slope_deg": 20.0
    }
    resp = client.post("/api/v1/routes/plan", json=payload)
    assert resp.status_code == 200
    route = resp.json()
    assert route["total_distance_m"] > 2000.0
    assert len(route["coords_lonlat"]) > 5
    assert len(route["elevation_profile"]) == len(route["coords_lonlat"])
    assert route["max_slope_deg"] <= 20.0

def test_route_compare_endpoint():
    payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350,
        "max_slope_deg": 20.0
    }
    resp = client.post("/api/v1/routes/compare", json=payload)
    assert resp.status_code == 200
    res = resp.json()
    assert "shortest" in res["routes"]
    assert "safe" in res["routes"]
    assert "recommendation" in res

def test_mission_simulate_endpoint():
    payload = {
        "distance_m": 3000.0,
        "walking_time_s": 3600.0,
        "science_duration_min": 45.0,
        "contingency_pct": 15.0,
        "o2_capacity_kg": 1.20,
        "battery_capacity_wh": 1000.0,
        "cooling_water_kg": 4.0,
        "mandatory_reserve_pct": 20.0
    }
    resp = client.post("/api/v1/missions/simulate", json=payload)
    assert resp.status_code == 200
    sim = resp.json()
    assert sim["is_feasible"] == True
    assert sim["feasibility_status"] == "FEASIBLE"
    assert sim["o2_remaining_pct"] > 50.0

def test_report_generate_endpoint():
    route_payload = {
        "start_lon": 77.4508,
        "start_lat": 18.4447,
        "goal_lon": 77.4060,
        "goal_lat": 18.4350,
        "mode": "safe"
    }
    route_resp = client.post("/api/v1/routes/plan", json=route_payload).json()

    sim_payload = {
        "distance_m": route_resp["total_distance_m"],
        "walking_time_s": route_resp["estimated_duration_s"],
        "science_duration_min": 45.0
    }
    sim_resp = client.post("/api/v1/missions/simulate", json=sim_payload).json()
    env_resp = client.get("/api/v1/environment").json()

    report_payload = {
        "mission_id": "TEST-EVA-01",
        "crew_names": ["Commander Shepard", "Dr. Liara T'Soni"],
        "start_name": "Octavia E. Butler Base",
        "start_coords": [77.4508, 18.4447],
        "target_id": "JEZ-SCI-02",
        "route_plan": route_resp,
        "simulation": sim_resp,
        "environment": env_resp
    }
    report_resp = client.post("/api/v1/reports/generate", json=report_payload)
    assert report_resp.status_code == 200
    rep = report_resp.json()
    assert "briefing_data" in rep
    assert "markdown_report" in rep
    assert "# MARSWALK EXPEDITION BRIEFING" in rep["markdown_report"]
