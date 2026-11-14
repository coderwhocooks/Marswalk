import numpy as np
import pytest
from backend.core.terrain import TerrainModel
from backend.core.router import MartianAStarRouter, RouteResult

def test_straight_line_path_on_flat_terrain():
    # 30x30 flat terrain
    elevation = np.full((30, 30), -2400.0, dtype=np.float32)
    terrain = TerrainModel(elevation=elevation, pixel_size=10.0, x0=0.0, y0=0.0)
    router = MartianAStarRouter(terrain)

    # Start at (5, 5), Goal at (25, 5) [vertical straight line]
    result = router.plan_pixel_path(start_row=5, start_col=5, goal_row=25, goal_col=5, mode="shortest")
    assert result is not None
    assert isinstance(result, RouteResult)
    # 20 steps of 10m = 200m
    assert result.total_distance_m == pytest.approx(200.0, abs=0.5)
    assert len(result.pixel_path) == 21
    assert result.max_slope_deg == pytest.approx(0.0, abs=0.01)

def test_obstacle_avoidance():
    # 30x30 flat terrain with a vertical wall of steep slope in the middle
    elevation = np.full((30, 30), -2400.0, dtype=np.float32)
    # Create a steep ridge at col 15 from row 5 to 25
    elevation[5:26, 15] = -2300.0 # 100m rise over 10m = huge slope > 80 deg
    terrain = TerrainModel(elevation=elevation, pixel_size=10.0, x0=0.0, y0=0.0)
    router = MartianAStarRouter(terrain)

    # Route from (15, 5) to (15, 25) must navigate around the wall
    result = router.plan_pixel_path(start_row=15, start_col=5, goal_row=15, goal_col=25, max_slope_deg=20.0)
    assert result is not None
    assert result.total_distance_m > 200.0 # Had to detour
    # Verify no cell in the path exceeds max_slope_deg
    assert result.max_slope_deg <= 20.0
    for r, c in result.pixel_path:
        assert not (5 <= r <= 25 and c == 15)

def test_astar_matches_dijkstra_optimality():
    # Random gentle undulating terrain
    np.random.seed(42)
    elevation = -2400.0 + np.random.uniform(-5, 5, size=(25, 25)).astype(np.float32)
    terrain = TerrainModel(elevation=elevation, pixel_size=10.0, x0=0.0, y0=0.0)
    router = MartianAStarRouter(terrain)

    start = (2, 2)
    goal = (22, 22)

    astar_res = router.plan_pixel_path(start[0], start[1], goal[0], goal[1], mode="safe")
    dijkstra_res = router.dijkstra_baseline(start[0], start[1], goal[0], goal[1], mode="safe")

    assert astar_res is not None
    assert dijkstra_res is not None
    # Both algorithms must find the exact same optimal cost
    assert astar_res.total_cost == pytest.approx(dijkstra_res.total_cost, rel=1e-4)

def test_cost_monotonicity_slopes():
    # Terrain with a moderate hill in the direct path
    elevation = np.zeros((30, 30), dtype=np.float32)
    # Hill in center: elevates gradually to 15 degrees
    for r in range(30):
        for c in range(30):
            dist = np.hypot(r - 15, c - 15)
            if dist < 8:
                elevation[r, c] = (8 - dist) * 2.5 # creates ~14 deg slope

    terrain = TerrainModel(elevation=elevation, pixel_size=10.0, x0=0.0, y0=0.0)
    router = MartianAStarRouter(terrain)

    # Shortest mode cuts straight or diagonal through the hill (slope < 20 deg is allowed)
    res_shortest = router.plan_pixel_path(5, 5, 25, 25, mode="shortest", max_slope_deg=25.0)
    # Safe mode avoids the hill slope penalty by skirting around
    res_safe = router.plan_pixel_path(5, 5, 25, 25, mode="safe", w_slope=8.0, max_slope_deg=25.0)

    assert res_shortest is not None
    assert res_safe is not None
    assert res_shortest.total_distance_m <= res_safe.total_distance_m
    assert res_safe.avg_slope_deg < res_shortest.avg_slope_deg

def test_real_jezero_route_planning():
    dtm_path = 'c:/myProjects/Marswalk/backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif'
    terrain = TerrainModel.from_geotiff(dtm_path)
    # Downsample by 4x (80m grid) for ultra-fast unit testing traverse
    ds_terrain = terrain.downsample(4)
    router = MartianAStarRouter(ds_terrain)

    # Octavia Butler Landing: 18.4447 N, 77.4508 E
    # Delta Scarp Front: 18.4350 N, 77.4060 E
    res = router.plan_lonlat_route(
        start_lon=77.4508,
        start_lat=18.4447,
        goal_lon=77.4060,
        goal_lat=18.4350,
        mode="safe"
    )
    assert res is not None
    assert res.total_distance_m > 2000.0 # ~2-3 km distance
    assert res.total_distance_m < 5000.0
    assert len(res.coords_lonlat) > 10
    assert res.max_slope_deg <= 20.0
