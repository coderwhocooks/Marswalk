"""
Marswalk Autonomous Science Discovery Engine.
Identifies high-value planetary geological formations, evaluates Scientific Value Density (SVD),
and synthesizes multi-stop exploration itineraries via bounded prize-collecting optimization.
"""
from dataclasses import dataclass, field
import math
from typing import List, Dict, Any, Optional

from backend.core.science import ScienceCatalog, ScienceTarget
from backend.core.geodesy import mars_haversine_distance

@dataclass
class DiscoveredTarget:
    target_id: str
    name: str
    lon: float
    lat: float
    geological_unit: str
    mineralogy: str
    relevance: float
    data_quality: float
    distance_m: float
    scientific_value_density: float
    recommended_instrument: str
    evidence_summary: str

@dataclass
class TourStop:
    stop_number: int
    target_id: str
    name: str
    lon: float
    lat: float
    arrival_time_min: float
    dwell_time_min: float
    science_value: float

@dataclass
class ScienceTour:
    stops: List[TourStop]
    total_distance_km: float
    total_duration_h: float
    total_science_value: float
    return_feasible: bool
    itinerary_summary: str

class ScienceDiscoveryEngine:
    """
    Autonomous target discovery and science-maximizing traverse optimizer.
    """
    def __init__(self, catalog: Optional[ScienceCatalog] = None):
        self.catalog = catalog or ScienceCatalog()
        # Average suited astronaut speed across Jezero terrain
        self.avg_speed_ms = 0.75 

    def discover_targets(
        self,
        current_lon: float,
        current_lat: float,
        max_search_radius_m: float = 12000.0,
        min_relevance: float = 6.0
    ) -> List[DiscoveredTarget]:
        """
        Scan catalog and geological features for scientific targets within operational radius,
        ranked by Scientific Value Density: SVD = (Relevance * Quality) / Distance_Factor.
        """
        raw_targets = self.catalog.list_targets()
        discovered: List[DiscoveredTarget] = []

        for t in raw_targets:
            if t.scientific_relevance < min_relevance:
                continue

            dist = mars_haversine_distance(current_lon, current_lat, t.lon, t.lat)
            if dist > max_search_radius_m:
                continue

            # Distance impedance factor (non-linear penalty for far targets)
            dist_factor = max(dist / 1000.0, 0.5) ** 0.8
            # Scientific Value Density
            raw_score = (t.scientific_relevance * 0.5 + t.mineralogical_evidence * 0.3 + t.data_quality * 0.2)
            svd = round((raw_score / dist_factor) * 10.0, 2)

            evidence = f"{t.geological_unit} ({t.mineralogy}) verified by {t.supporting_instrument} on {t.supporting_mission}."

            discovered.append(DiscoveredTarget(
                target_id=t.target_id,
                name=t.name,
                lon=t.lon,
                lat=t.lat,
                geological_unit=t.geological_unit,
                mineralogy=t.mineralogy,
                relevance=round(t.scientific_relevance, 1),
                data_quality=round(t.data_quality, 1),
                distance_m=round(dist, 1),
                scientific_value_density=svd,
                recommended_instrument=t.supporting_instrument,
                evidence_summary=evidence
            ))

        discovered.sort(key=lambda x: x.scientific_value_density, reverse=True)
        return discovered

    def optimize_science_tour(
        self,
        start_lon: float,
        start_lat: float,
        time_budget_h: float = 4.0,
        dwell_per_stop_min: float = 30.0
    ) -> ScienceTour:
        """
        Bounded prize-collecting orienteering heuristic.
        Selects a sequence of targets that maximizes aggregate science score
        while ensuring return to the start base before the time budget expires.
        """
        all_targets = self.catalog.list_targets()
        time_budget_s = time_budget_h * 3600.0
        dwell_s = dwell_per_stop_min * 60.0

        # Greedy prize-collecting selection with round-trip feasibility check
        visited: List[ScienceTarget] = []
        unvisited = list(all_targets)
        current_lon, current_lat = start_lon, start_lat

        elapsed_s = 0.0
        total_dist_m = 0.0
        total_score = 0.0

        tour_stops: List[TourStop] = []

        while unvisited:
            best_candidate = None
            best_ratio = -1.0
            best_leg_dist = 0.0
            best_leg_time = 0.0

            for cand in unvisited:
                leg_dist = mars_haversine_distance(current_lon, current_lat, cand.lon, cand.lat)
                leg_time = leg_dist / self.avg_speed_ms

                # Distance from candidate back to base
                return_dist = mars_haversine_distance(cand.lon, cand.lat, start_lon, start_lat)
                return_time = return_dist / self.avg_speed_ms

                # Total projected time if we visit this candidate and then return to base
                projected_total = elapsed_s + leg_time + dwell_s + return_time

                if projected_total <= time_budget_s:
                    score = cand.scientific_relevance * 2.0 + cand.mineralogical_evidence
                    ratio = score / max(leg_dist, 100.0)
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_candidate = cand
                        best_leg_dist = leg_dist
                        best_leg_time = leg_time

            if not best_candidate:
                break # No further candidate can be visited within remaining budget

            # Commit stop
            visited.append(best_candidate)
            unvisited.remove(best_candidate)

            elapsed_s += best_leg_time
            arrival_min = elapsed_s / 60.0
            elapsed_s += dwell_s
            total_dist_m += best_leg_dist
            total_score += (best_candidate.scientific_relevance * 10.0)

            current_lon, current_lat = best_candidate.lon, best_candidate.lat

            tour_stops.append(TourStop(
                stop_number=len(tour_stops) + 1,
                target_id=best_candidate.target_id,
                name=best_candidate.name,
                lon=best_candidate.lon,
                lat=best_candidate.lat,
                arrival_time_min=round(arrival_min, 1),
                dwell_time_min=dwell_per_stop_min,
                science_value=round(best_candidate.scientific_relevance * 10.0, 1)
            ))

        # Add return leg to base
        final_return_dist = mars_haversine_distance(current_lon, current_lat, start_lon, start_lat)
        total_dist_m += final_return_dist
        elapsed_s += (final_return_dist / self.avg_speed_ms)

        summary = f"Optimized {len(tour_stops)}-stop science traverse yielding {total_score:.0f} scientific value units across {total_dist_m/1000.0:.2f} km."

        return ScienceTour(
            stops=tour_stops,
            total_distance_km=round(total_dist_m / 1000.0, 2),
            total_duration_h=round(elapsed_s / 3600.0, 2),
            total_science_value=round(total_score, 1),
            return_feasible=(elapsed_s <= time_budget_s),
            itinerary_summary=summary
        )
