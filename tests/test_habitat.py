"""
Unit tests for Dynamic Habitat and Exploration Base Selection Engine.
"""
import pytest
from backend.core.terrain import TerrainModel
from backend.core.science import ScienceCatalog
from backend.core.habitat import HabitatSelectionEngine

DTM_PATH = "backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif"

@pytest.fixture
def terrain():
    return TerrainModel.from_geotiff(DTM_PATH).downsample(2)

@pytest.fixture
def catalog():
    return ScienceCatalog()

@pytest.fixture
def habitat_engine(terrain, catalog):
    return HabitatSelectionEngine(terrain=terrain, catalog=catalog)

def test_habitat_candidate_evaluation(habitat_engine):
    candidates = habitat_engine.evaluate_candidates()
    assert len(candidates) >= 3
    # Top candidate has high suitability score
    top = candidates[0]
    assert 70.0 <= top.composite_suitability <= 100.0
    assert top.slope_deg < 6.0
    assert top.roughness_m < 2.5
    assert len(top.criteria_scores) == 5
    assert len(top.pros) > 0
    assert len(top.cons) > 0

def test_point_suitability_evaluator(habitat_engine):
    # Test Octavia Butler Base point
    score = habitat_engine.evaluate_point_suitability(lon=77.4508, lat=18.4447)
    assert 0.0 <= score.composite_suitability <= 100.0
    assert "slope_flatness" in score.criteria_scores
    assert "surface_smoothness" in score.criteria_scores
    assert "science_reachability" in score.criteria_scores
