"""
Unit tests for Autonomous Science Discovery Engine.
"""
import pytest
from backend.core.science import ScienceCatalog
from backend.core.discovery import ScienceDiscoveryEngine

@pytest.fixture
def catalog():
    return ScienceCatalog()

@pytest.fixture
def discovery_engine(catalog):
    return ScienceDiscoveryEngine(catalog)

def test_autonomous_target_discovery(discovery_engine):
    base_lon, base_lat = 77.4508, 18.4447
    discovered = discovery_engine.discover_targets(
        current_lon=base_lon,
        current_lat=base_lat,
        max_search_radius_m=8000.0,
        min_relevance=7.0
    )
    assert len(discovered) >= 4
    # Ensure ranked by scientific value density
    for t in discovered:
        assert t.scientific_value_density > 0.0
        assert t.relevance >= 7.0
        assert len(t.evidence_summary) > 0

def test_science_tour_optimization(discovery_engine):
    base_lon, base_lat = 77.4508, 18.4447
    time_budget_hours = 4.0 # 4 hour EVA
    
    tour = discovery_engine.optimize_science_tour(
        start_lon=base_lon,
        start_lat=base_lat,
        time_budget_h=time_budget_hours,
        dwell_per_stop_min=30.0
    )
    assert tour is not None
    assert len(tour.stops) >= 1
    assert tour.total_duration_h <= time_budget_hours
    assert tour.total_science_value > 0.0
    assert tour.return_feasible == True
