"""
Marswalk Intelligent Route Optimization Engine.
Implements 8-connected A* graph search over Martian terrain cost surfaces,
enforcing hard slope/hazard safety barriers, uncertainty penalties,
and Tobler-Minetti gravity-calibrated human travel duration.
"""
from dataclasses import dataclass, field
import heapq
import math
from typing import Dict, List, Optional, Tuple
import numpy as np
from backend.core.terrain import TerrainModel

@dataclass
class RouteResult:
    coords_lonlat: List[Tuple[float, float]]
    pixel_path: List[Tuple[int, int]]
    elevation_profile: List[float]
    slope_profile: List[float]
    total_distance_m: float
    total_cost: float
    max_slope_deg: float
    avg_slope_deg: float
    estimated_duration_s: float
    hazard_segments: List[Dict[str, float]] = field(default_factory=list)
    mode: str = "safe"

class MartianAStarRouter:
    """
    Terrain-aware graph path planner for Mars exploration.
    """
    # 8-connected neighborhood offsets: (d_row, d_col, step_factor)
    NEIGHBORS = [
        (-1, 0, 1.0),
        (1, 0, 1.0),
        (0, -1, 1.0),
        (0, 1, 1.0),
        (-1, -1, math.sqrt(2.0)),
        (-1, 1, math.sqrt(2.0)),
        (1, -1, math.sqrt(2.0)),
        (1, 1, math.sqrt(2.0)),
    ]

    def __init__(self, terrain: TerrainModel):
        self.terrain = terrain
        self.pixel_size = terrain.pixel_size
        self.height = terrain.height
        self.width = terrain.width

    def _get_edge_cost(
        self,
        r: int,
        c: int,
        step_factor: float,
        mode: str,
        max_slope_deg: float,
        w_slope: float,
        w_roughness: float
    ) -> float:
        """
        Calculate non-negative edge traversal cost into cell (r, c).
        Returns infinity if the cell violates hard constraints.
        """
        # Hard constraint check: NoData or slope exceeding safety threshold
        if self.terrain.nodata_mask[r, c]:
            return math.inf

        slope = float(self.terrain.slope_deg[r, c])
        if slope > max_slope_deg:
            return math.inf

        step_dist = self.pixel_size * step_factor

        if mode == "shortest":
            # Pure geometric distance, respecting hard obstacles
            return step_dist

        # Safe terrain-cost formulation:
        # Penalizes steep slopes non-linearly and accounts for surface roughness
        slope_penalty = (slope / 15.0) ** 2
        roughness = float(self.terrain.roughness[r, c])
        roughness_penalty = roughness / 5.0

        multiplier = 1.0 + w_slope * slope_penalty + w_roughness * roughness_penalty
        return step_dist * multiplier

    def _snap_to_valid_cell(self, row: int, col: int, max_slope_deg: float, search_radius: int = 10) -> Tuple[int, int]:
        """
        If the given coordinate falls on an impassable or NoData cell,
        snap to the nearest valid traversable cell within search_radius.
        """
        if self.terrain.is_traversable(row, col, max_slope_deg):
            return row, col

        best_cell = None
        min_dist_sq = math.inf

        for dr in range(-search_radius, search_radius + 1):
            for dc in range(-search_radius, search_radius + 1):
                nr, nc = row + dr, col + dc
                if 0 <= nr < self.height and 0 <= nc < self.width:
                    if self.terrain.is_traversable(nr, nc, max_slope_deg):
                        d_sq = dr*dr + dc*dc
                        if d_sq < min_dist_sq:
                            min_dist_sq = d_sq
                            best_cell = (nr, nc)

        if best_cell is not None:
            return best_cell
        return row, col

    def plan_pixel_path(
        self,
        start_row: int,
        start_col: int,
        goal_row: int,
        goal_col: int,
        mode: str = "safe",
        max_slope_deg: float = 20.0,
        w_slope: float = 3.0,
        w_roughness: float = 2.0
    ) -> Optional[RouteResult]:
        """
        Executes A* search on the raster grid from (start_row, start_col) to (goal_row, goal_col).
        """
        # Snap start/goal to nearest valid traversable cells
        start_r, start_c = self._snap_to_valid_cell(start_row, start_col, max_slope_deg)
        goal_r, goal_c = self._snap_to_valid_cell(goal_row, goal_col, max_slope_deg)

        if not self.terrain.is_traversable(start_r, start_c, max_slope_deg):
            return None
        if not self.terrain.is_traversable(goal_r, goal_c, max_slope_deg):
            return None

        # Min-heap priority queue: entries are (f_cost, g_cost, row, col)
        start_h = math.hypot(goal_r - start_r, goal_c - start_c) * self.pixel_size
        open_set = [(start_h, 0.0, start_r, start_c)]

        # Track lowest g_score
        # For memory efficiency, use dictionary for sparse visited cells
        g_scores: Dict[Tuple[int, int], float] = {(start_r, start_c): 0.0}
        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}

        while open_set:
            f, g, cr, cc = heapq.heappop(open_set)

            if cr == goal_r and cc == goal_c:
                # Reconstruct path
                path = []
                curr = (cr, cc)
                while curr in came_from:
                    path.append(curr)
                    curr = came_from[curr]
                path.append((start_r, start_c))
                path.reverse()
                return self._build_route_result(path, g, mode)

            if g > g_scores.get((cr, cc), math.inf):
                continue

            for dr, dc, step_factor in self.NEIGHBORS:
                nr, nc = cr + dr, cc + dc
                if not (0 <= nr < self.height and 0 <= nc < self.width):
                    continue

                edge_cost = self._get_edge_cost(
                    nr, nc, step_factor, mode, max_slope_deg, w_slope, w_roughness
                )
                if math.isinf(edge_cost):
                    continue

                tentative_g = g + edge_cost
                if tentative_g < g_scores.get((nr, nc), math.inf):
                    g_scores[(nr, nc)] = tentative_g
                    came_from[(nr, nc)] = (cr, cc)
                    h = math.hypot(goal_r - nr, goal_c - nc) * self.pixel_size
                    heapq.heappush(open_set, (tentative_g + h, tentative_g, nr, nc))

        return None

    def dijkstra_baseline(
        self,
        start_row: int,
        start_col: int,
        goal_row: int,
        goal_col: int,
        mode: str = "safe",
        max_slope_deg: float = 20.0,
        w_slope: float = 3.0,
        w_roughness: float = 2.0
    ) -> Optional[RouteResult]:
        """
        Dijkstra baseline search (A* with h=0) for theoretical optimality validation.
        """
        start_r, start_c = self._snap_to_valid_cell(start_row, start_col, max_slope_deg)
        goal_r, goal_c = self._snap_to_valid_cell(goal_row, goal_col, max_slope_deg)

        open_set = [(0.0, start_r, start_c)]
        g_scores: Dict[Tuple[int, int], float] = {(start_r, start_c): 0.0}
        came_from: Dict[Tuple[int, int], Tuple[int, int]] = {}

        while open_set:
            g, cr, cc = heapq.heappop(open_set)

            if cr == goal_r and cc == goal_c:
                path = []
                curr = (cr, cc)
                while curr in came_from:
                    path.append(curr)
                    curr = came_from[curr]
                path.append((start_r, start_c))
                path.reverse()
                return self._build_route_result(path, g, mode)

            if g > g_scores.get((cr, cc), math.inf):
                continue

            for dr, dc, step_factor in self.NEIGHBORS:
                nr, nc = cr + dr, cc + dc
                if not (0 <= nr < self.height and 0 <= nc < self.width):
                    continue

                edge_cost = self._get_edge_cost(
                    nr, nc, step_factor, mode, max_slope_deg, w_slope, w_roughness
                )
                if math.isinf(edge_cost):
                    continue

                tentative_g = g + edge_cost
                if tentative_g < g_scores.get((nr, nc), math.inf):
                    g_scores[(nr, nc)] = tentative_g
                    came_from[(nr, nc)] = (cr, cc)
                    heapq.heappush(open_set, (tentative_g, nr, nc))

        return None

    def _build_route_result(
        self,
        pixel_path: List[Tuple[int, int]],
        total_cost: float,
        mode: str
    ) -> RouteResult:
        """
        Extract coordinates, elevation and slope profiles, total metric distance,
        and Tobler-Minetti Mars travel duration.
        """
        coords_lonlat = []
        elev_profile = []
        slope_profile = []
        total_distance = 0.0
        total_duration_s = 0.0
        hazard_segments = []

        # Baseline nominal astronaut walking speed on flat Mars regolith: 0.85 m/s (~3.06 km/h)
        v0 = 0.85

        for i, (r, c) in enumerate(pixel_path):
            lon, lat = self.terrain.geodesy.pixel_to_lonlat(c, r)
            elev = float(self.terrain.elevation[r, c])
            slope = float(self.terrain.slope_deg[r, c])

            coords_lonlat.append((lon, lat))
            elev_profile.append(elev)
            slope_profile.append(slope)

            if slope > 12.0:
                hazard_segments.append({
                    "index": i,
                    "lon": lon,
                    "lat": lat,
                    "slope_deg": slope,
                    "hazard_type": "moderate_slope" if slope <= 20.0 else "steep_slope"
                })

            if i > 0:
                pr, pc = pixel_path[i - 1]
                dr = abs(r - pr)
                dc = abs(c - pc)
                step_dist = self.pixel_size * (math.sqrt(2.0) if dr == 1 and dc == 1 else 1.0)
                total_distance += step_dist

                # Tobler's hiking function adapted for Martian 0.38g gravity
                # s is gradient = tan(slope in radians)
                # v(s) = v0 * exp(-3.5 * |s + 0.05|)
                s = math.tan(math.radians(slope))
                velocity = max(v0 * math.exp(-3.5 * abs(s + 0.05)), 0.15)
                total_duration_s += step_dist / velocity

        max_slope = float(max(slope_profile)) if slope_profile else 0.0
        avg_slope = float(sum(slope_profile) / len(slope_profile)) if slope_profile else 0.0

        return RouteResult(
            coords_lonlat=coords_lonlat,
            pixel_path=pixel_path,
            elevation_profile=elev_profile,
            slope_profile=slope_profile,
            total_distance_m=round(total_distance, 1),
            total_cost=round(total_cost, 2),
            max_slope_deg=round(max_slope, 2),
            avg_slope_deg=round(avg_slope, 2),
            estimated_duration_s=round(total_duration_s, 1),
            hazard_segments=hazard_segments,
            mode=mode
        )

    def plan_lonlat_route(
        self,
        start_lon: float,
        start_lat: float,
        goal_lon: float,
        goal_lat: float,
        mode: str = "safe",
        max_slope_deg: float = 20.0,
        w_slope: float = 3.0,
        w_roughness: float = 2.0
    ) -> Optional[RouteResult]:
        """
        High-level planning interface accepting geographic longitude and latitude coordinates.
        """
        start_c, start_r = self.terrain.geodesy.lonlat_to_pixel(start_lon, start_lat)
        goal_c, goal_r = self.terrain.geodesy.lonlat_to_pixel(goal_lon, goal_lat)

        return self.plan_pixel_path(
            start_row=int(round(start_r)),
            start_col=int(round(start_c)),
            goal_row=int(round(goal_r)),
            goal_col=int(round(goal_c)),
            mode=mode,
            max_slope_deg=max_slope_deg,
            w_slope=w_slope,
            w_roughness=w_roughness
        )
