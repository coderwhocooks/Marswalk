import pytest
from backend.core.science import ScienceCatalog, ScienceTarget
from backend.core.environment import EnvironmentalModel

def test_science_catalog_loads_jezero_targets():
    catalog = ScienceCatalog()
    targets = catalog.list_targets()
    assert len(targets) >= 6
    
    # Verify Hawksbill Gap and Kodiak are present
    target_names = [t.name for t in targets]
    assert any("Hawksbill" in name for name in target_names)
    assert any("Kodiak" in name for name in target_names)
    assert any("Butler" in name for name in target_names)

def test_science_target_provenance():
    catalog = ScienceCatalog()
    target = catalog.get_target_by_id("JEZ-SCI-02") # Hawksbill Gap
    assert target is not None
    assert target.supporting_mission == "Mars 2020 / Perseverance"
    assert target.geological_unit == "Shenandoah / Amalik Formation"
    assert "smectite" in target.mineralogy.lower() or "clay" in target.mineralogy.lower()
    assert target.scientific_relevance >= 8.0

def test_science_target_scoring_monotonicity():
    catalog = ScienceCatalog()
    # Rank targets relative to Octavia Butler Landing site
    ranked = catalog.rank_targets(current_lon=77.4508, current_lat=18.4447, alpha=1.0, beta=1.0, gamma=1.0, delta=0.5)
    assert len(ranked) > 0
    # First ranked target must have higher total score than the last
    assert ranked[0].composite_score >= ranked[-1].composite_score

def test_environmental_meda_profiles():
    env = EnvironmentalModel()
    # Query environmental conditions at midday (13:00 LMST)
    midday = env.get_conditions(lmst_hour=13.0, mission_duration_hours=4.0)
    assert -25.0 < midday["surface_temp_c"] < 0.0
    assert 680.0 < midday["pressure_pa"] < 760.0
    assert midday["wind_speed_ms"] > 0.0
    assert midday["dust_optical_depth"] > 0.0
    
    # Query environmental conditions at night (04:00 LMST)
    night = env.get_conditions(lmst_hour=4.0, mission_duration_hours=4.0)
    assert night["surface_temp_c"] < -70.0
    # Night should be colder than midday
    assert night["surface_temp_c"] < midday["surface_temp_c"]

def test_radiation_dose_accumulation():
    env = EnvironmentalModel()
    cond_2h = env.get_conditions(lmst_hour=12.0, mission_duration_hours=2.0)
    cond_6h = env.get_conditions(lmst_hour=12.0, mission_duration_hours=6.0)
    assert cond_6h["radiation_dose_msv"] == pytest.approx(cond_2h["radiation_dose_msv"] * 3.0, abs=1e-3)
