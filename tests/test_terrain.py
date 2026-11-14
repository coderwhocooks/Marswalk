import math
import numpy as np
import pytest
from backend.core.terrain import TerrainModel

def test_flat_dem_produces_zero_slope():
    data = np.full((50, 50), -2400.0, dtype=np.float32)
    terrain = TerrainModel(
        elevation=data,
        pixel_size=20.0,
        x0=4573663.0,
        y0=1109693.0
    )
    slope = terrain.slope_deg
    assert np.all(slope >= 0.0)
    assert np.all(slope < 0.01)

def test_known_gradient_produces_expected_slope():
    # Construct a plane with exact 15-degree slope along X
    pixel_size = 20.0
    target_slope_deg = 15.0
    grad_x = math.tan(math.radians(target_slope_deg))
    
    rows, cols = 40, 40
    data = np.zeros((rows, cols), dtype=np.float32)
    for c in range(cols):
        data[:, c] = c * pixel_size * grad_x
        
    terrain = TerrainModel(
        elevation=data,
        pixel_size=pixel_size,
        x0=0.0,
        y0=0.0
    )
    # Check interior slope (avoiding border boundary effects)
    interior_slope = terrain.slope_deg[2:-2, 2:-2]
    assert np.allclose(interior_slope, target_slope_deg, atol=0.1)

def test_45_degree_gradient():
    pixel_size = 10.0
    rows, cols = 30, 30
    data = np.zeros((rows, cols), dtype=np.float32)
    for c in range(cols):
        data[:, c] = c * pixel_size * 1.0 # dz/dx = 1.0 -> 45 degrees
        
    terrain = TerrainModel(
        elevation=data,
        pixel_size=pixel_size,
        x0=0.0,
        y0=0.0
    )
    interior_slope = terrain.slope_deg[2:-2, 2:-2]
    assert np.allclose(interior_slope, 45.0, atol=0.1)

def test_nodata_handling():
    data = np.full((20, 20), -2400.0, dtype=np.float32)
    data[10, 10] = -99999.0 # nodata flag
    data[10, 11] = np.nan
    terrain = TerrainModel(
        elevation=data,
        pixel_size=20.0,
        x0=0.0,
        y0=0.0,
        nodata_threshold=-10000.0
    )
    assert terrain.nodata_mask[10, 10] == True
    assert terrain.nodata_mask[10, 11] == True
    assert terrain.nodata_mask[0, 0] == False
    assert not terrain.is_traversable(10, 10, max_slope_deg=20.0)

def test_real_jezero_dtm_metrics():
    # Test loading real CTX DTM file if available
    dtm_path = 'c:/myProjects/Marswalk/backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
    terrain = TerrainModel.from_geotiff(dtm_path)
    assert terrain.width == 1596
    assert terrain.height == 1512
    assert terrain.pixel_size == 20.0
    assert terrain.elevation.shape == (1512, 1596)
    
    # Check valid elevations in Jezero
    valid = terrain.elevation[~terrain.nodata_mask]
    assert -2800.0 < valid.min() < -2600.0
    assert -1600.0 < valid.max() < -1400.0
    
    # Check slope distribution
    slopes = terrain.slope_deg[~terrain.nodata_mask]
    assert slopes.min() >= 0.0
    assert slopes.max() > 25.0 # Crater rims and scarps have steep slopes
    assert np.median(slopes) < 10.0 # Most of crater floor is relatively flat
