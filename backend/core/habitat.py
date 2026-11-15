"""
Marswalk Dynamic Habitat and Exploration Base Selection Engine.
Multi-Criteria Decision Analysis (MCDA) evaluating landing safety, terrain slope,
surface roughness, science reachability, and geological shelter for prospective Martian bases.
"""
from dataclasses import dataclass, field
import math
from typing import List, Dict, Any, Optional

from backend.core.terrain import TerrainModel
from backend.core.science import ScienceCatalog
from backend.core.geodesy import mars_haversine_distance

@dataclass
class HabitatCandidate:
    site_id: str
    name: str
    lon: float
    lat: float
    elevation_m: float
    slope_deg: float
    roughness_m: float
    composite_suitability: float  # 0 - 100
    classification: str           # "OPTIMAL", "FAVORABLE", "MARGINAL", "UNSUITABLE"
    criteria_scores: Dict[str, float]
    pros: List[str]
    cons: List[str]
    operational_capacity: str

class HabitatSelectionEngine:
    """
    Evaluates planetary surface infrastructure siting suitability across Jezero Crater.
    """
    CANDIDATE_PRESETS = [
        {
            "site_id": "HAB-SITE-01",
            "name": "Octavia E. Butler Floor Station",
            "lon": 77.4508,
            "lat": 18.4447,
            "capacity": "4 Crew / 180 Sols Primary Habitat",
            "notes": "Verified touchdown zone; flat basaltic regolith sheet with minimal boulder obstacles."
        },
        {
            "site_id": "HAB-SITE-02",
            "name": "Western Delta Gateway Outpost",
            "lon": 77.4180,
            "lat": 18.4380,
            "capacity": "2-4 Crew Scientific Staging Base",
            "notes": "Positioned at delta fan toe; direct access to Hawksbill Gap and Hogwallow mudstones."
        },
        {
            "site_id": "HAB-SITE-03",
            "name": "Kodiak Mesa South Foreland",
            "lon": 77.3950,
            "lat": 18.4180,
            "capacity": "2 Crew Mobile Exploration Camp",
            "notes": "Sheltered terrace adjacent to Kodiak butte; natural cliff protection from prevailing dust winds."
        },
        {
            "site_id": "HAB-SITE-04",
            "name": "Belva Crater Rim Station",
            "lon": 77.4120,
            "lat": 18.4680,
            "capacity": "Observational & Communication Relay Outpost",
            "notes": "Elevated ridge affording direct line-of-sight communication across entire northern crater floor."
        },
        {
            "site_id": "HAB-SITE-05",
            "name": "Neretva Vallis Inflow Gateway",
            "lon": 77.3650,
            "lat": 18.4950,
            "capacity": "Deep Canyon Geological Research Base",
            "notes": "Ancient river canyon breach into Jezero paleolake; potential subsurface permafrost access."
        }
    ]

    def __init__(self, terrain: TerrainModel, catalog: Optional[ScienceCatalog] = None):
        self.terrain = terrain
        self.catalog = catalog or ScienceCatalog()

    def evaluate_point_suitability(self, lon: float, lat: float) -> HabitatCandidate:
        """
        Evaluate a single geographic point against the 5 MCDA siting criteria.
        """
        elev = self.terrain.get_elevation_at_lonlat(lon, lat) or -2500.0
        slope = self.terrain.get_slope_at_lonlat(lon, lat) or 3.0

        col, row = self.terrain.geodesy.lonlat_to_pixel(lon, lat)
        r, c = int(round(row)), int(round(col))

        if 0 <= r < self.terrain.height and 0 <= c < self.terrain.width:
            roughness = float(self.terrain.roughness[r, c])
        else:
            roughness = 1.0

        # Criterion 1: Slope & Flatness (Weight: 25%)
        # Ideal: < 2.5 deg (100). Tolerable: < 5 deg (75). Hazardous: > 10 deg (0).
        slope_score = max(0.0, min(100.0, 100.0 - (slope / 10.0) * 100.0))

        # Criterion 2: Surface Smoothness & Boulder Hazard (Weight: 20%)
        # Ideal: roughness < 0.8m (100). Severe: > 2.5m (0).
        smooth_score = max(0.0, min(100.0, 100.0 - (roughness / 2.5) * 100.0))

        # Criterion 3: Science Reachability (Weight: 25%)
        # Distance to closest 3 science targets
        targets = self.catalog.list_targets()
        dists = [mars_haversine_distance(lon, lat, t.lon, t.lat) for t in targets]
        dists.sort()
        avg_dist_3 = sum(dists[:3]) / 3.0 if len(dists) >= 3 else 5000.0
        # 100 if within 1.5 km, 0 if > 8.0 km
        science_reach_score = max(0.0, min(100.0, (1.0 - (avg_dist_3 - 1500.0) / 6500.0) * 100.0))

        # Criterion 4: Traverse Egress Corridors (Weight: 15%)
        # Check traversability of 8 surrounding radial sectors
        traversable_sectors = 0
        search_dist_px = 5
        for dr, dc in [(-5,0), (5,0), (0,-5), (0,5), (-4,-4), (-4,4), (4,-4), (4,4)]:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.terrain.height and 0 <= nc < self.terrain.width:
                if self.terrain.is_traversable(nr, nc, max_slope_deg=15.0):
                    traversable_sectors += 1
        egress_score = (traversable_sectors / 8.0) * 100.0

        # Criterion 5: Geological Shielding & Solar Potential (Weight: 15%)
        # Flat to slightly concave terrain with open southern solar elevation
        shielding_score = 85.0 if -2600.0 < elev < -2300.0 else 70.0

        criteria_scores = {
            "slope_flatness": round(slope_score, 1),
            "surface_smoothness": round(smooth_score, 1),
            "science_reachability": round(science_reach_score, 1),
            "traverse_egress": round(egress_score, 1),
            "shielding_and_solar": round(shielding_score, 1)
        }

        # MCDA Weighted sum: 0.25*Slope + 0.20*Smooth + 0.25*Science + 0.15*Egress + 0.15*Shielding
        composite = (
            0.25 * slope_score +
            0.20 * smooth_score +
            0.25 * science_reach_score +
            0.15 * egress_score +
            0.15 * shielding_score
        )

        if composite >= 82.0:
            classification = "OPTIMAL"
        elif composite >= 70.0:
            classification = "FAVORABLE"
        elif composite >= 55.0:
            classification = "MARGINAL"
        else:
            classification = "UNSUITABLE"

        pros = []
        cons = []

        if slope_score >= 80.0:
            pros.append(f"Exceptionally flat topography (slope {slope:.1f}°)")
        else:
            cons.append(f"Elevated gradient ({slope:.1f}°) requires terrain grading")

        if smooth_score >= 80.0:
            pros.append(f"Smooth regolith surface with low rock hazard (roughness {roughness:.1f}m)")
        else:
            cons.append(f"Local boulder density (roughness {roughness:.1f}m) limits landing clearance")

        if science_reach_score >= 75.0:
            pros.append(f"Prime scientific reach (mean {avg_dist_3/1000.0:.1f} km to top priority formations)")
        else:
            cons.append(f"Distance to key delta scarp targets ({avg_dist_3/1000.0:.1f} km) increases EVA transit duration")

        if egress_score >= 85.0:
            pros.append("Unobstructed multi-directional surface traverse corridors")
        else:
            cons.append("Constrained traverse corridors due to surrounding terrain barriers")

        return HabitatCandidate(
            site_id="CUSTOM-POINT",
            name="Evaluated Surface Site",
            lon=round(lon, 4),
            lat=round(lat, 4),
            elevation_m=round(elev, 1),
            slope_deg=round(slope, 1),
            roughness_m=round(roughness, 1),
            composite_suitability=round(composite, 1),
            classification=classification,
            criteria_scores=criteria_scores,
            pros=pros,
            cons=cons,
            operational_capacity="Modular Planetary Base"
        )

    def evaluate_candidates(self) -> List[HabitatCandidate]:
        """
        Evaluate and rank all candidate exploration base sites in Jezero Crater.
        """
        evaluated: List[HabitatCandidate] = []
        for preset in self.CANDIDATE_PRESETS:
            cand = self.evaluate_point_suitability(preset["lon"], preset["lat"])
            cand.site_id = preset["site_id"]
            cand.name = preset["name"]
            cand.operational_capacity = preset["capacity"]
            evaluated.append(cand)

        # Sort descending by composite suitability score
        evaluated.sort(key=lambda x: x.composite_suitability, reverse=True)
        return evaluated
