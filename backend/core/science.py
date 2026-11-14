"""
Marswalk Scientific Exploration Catalog & Target Prioritization Engine.
Provides evidence-backed geological targets from USGS SIM 3464, MRO CRISM spectral
observations, and Mars 2020 Perseverance surface science campaigns.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import math
from backend.core.geodesy import mars_haversine_distance

@dataclass
class ScienceTarget:
    target_id: str
    name: str
    lon: float
    lat: float
    geological_unit: str
    unit_symbol: str
    mineralogy: str
    scientific_relevance: float  # Scale 1-10 (G_i)
    mineralogical_evidence: float  # Scale 1-10 (M_i)
    data_quality: float  # Scale 1-10 (Q_i)
    supporting_instrument: str
    supporting_mission: str
    product_identifier: str
    investigation_objective: str
    description: str
    composite_score: float = 0.0
    estimated_distance_m: float = 0.0

class ScienceCatalog:
    """
    Curated repository of Jezero Crater scientific points of interest with
    explainable multi-criteria ranking.
    """
    def __init__(self):
        self._targets: Dict[str, ScienceTarget] = {}
        self._load_baseline_jezero_targets()

    def _load_baseline_jezero_targets(self):
        targets_data = [
            ScienceTarget(
                target_id="JEZ-SCI-01",
                name="Octavia E. Butler Landing Site",
                lon=77.4508,
                lat=18.4447,
                geological_unit="Máaz Formation (Basaltic Crater Floor)",
                unit_symbol="cff",
                mineralogy="Pyroxene, plagioclase, olivine basalt",
                scientific_relevance=7.5,
                mineralogical_evidence=8.5,
                data_quality=9.5,
                supporting_instrument="PIXL, SHERLOC, SuperCam",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="USGS SIM 3464 / M2020_STAGE_01",
                investigation_objective="Calibrate geochronology of Jezero crater floor volcanic emplacement.",
                description="Igneous floor unit representing ancient volcanic flows or impact melt ponding in the crater."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-02",
                name="Hawksbill Gap (Delta Scarp Front)",
                lon=77.4060,
                lat=18.4350,
                geological_unit="Shenandoah / Amalik Formation",
                unit_symbol="fm",
                mineralogy="Smectite clay, sulfate salts, hydrated silica",
                scientific_relevance=9.8,
                mineralogical_evidence=9.5,
                data_quality=9.0,
                supporting_instrument="CRISM, SHERLOC, PIXL",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="CRISM_HRL000040FF / USGS SIM 3464",
                investigation_objective="Sample fine-grained lacustrine mudstone for biosignature and organic preservation.",
                description="Exposed bottomset and lower foreset sedimentary beds of the western Jezero delta with concentrated clay minerals."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-03",
                name="Kodiak Butte Delta Remnant",
                lon=77.3820,
                lat=18.4112,
                geological_unit="Kodiak Stratigraphic Clinoforms",
                unit_symbol="k",
                mineralogy="Layered siltstones, sandstones, iron-bearing phyllosilicates",
                scientific_relevance=9.4,
                mineralogical_evidence=8.0,
                data_quality=9.2,
                supporting_instrument="Mastcam-Z, SuperCam, HiRISE",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="HiRISE_ESP_037266_1985 / USGS SIM 3464",
                investigation_objective="Confirm lake highstand water level and delta progradation architecture.",
                description="Erosional remnant proving the western delta extended further south and into an open paleolake."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-04",
                name="Belva Impact Crater",
                lon=77.4042,
                lat=18.4725,
                geological_unit="Belva Crater Wall Stratigraphy",
                unit_symbol="b",
                mineralogy="Impact melt breccia, polymict conglomerates",
                scientific_relevance=8.8,
                mineralogical_evidence=8.0,
                data_quality=8.8,
                supporting_instrument="HiRISE, Mastcam-Z Long-range",
                supporting_mission="MRO / Mars 2020",
                product_identifier="HiRISE_PSP_002175_1985",
                investigation_objective="Study deep structural cross-section beneath delta deposit without deep drilling.",
                description="1-km diameter impact crater exposing excavated strata beneath the delta and underlying crater floor."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-05",
                name="Séítah Olivine-Cumulate Sand Dunes",
                lon=77.4350,
                lat=18.4380,
                geological_unit="Séítah Formation & Aeolian Dunes",
                unit_symbol="cf",
                mineralogy="Magnesian olivine cumulate, carbonate grains",
                scientific_relevance=8.6,
                mineralogical_evidence=9.2,
                data_quality=9.0,
                supporting_instrument="SHERLOC, PIXL, SuperCam",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="USGS SIM 3464 / M2020_SEITAH",
                investigation_objective="Examine ancient cumulate magma chamber crystallization and modern aeolian transport.",
                description="Layered igneous cumulate rock forming prominent ridges interspersed with hazardous active sand dunes."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-06",
                name="Marginal Carbonate Unit (Margin Unit)",
                lon=77.4700,
                lat=18.4800,
                geological_unit="Paleolake Shoreline Carbonate Unit",
                unit_symbol="m",
                mineralogy="Magnesite (MgCO3), silica, Fe/Mg-smectite",
                scientific_relevance=9.6,
                mineralogical_evidence=9.4,
                data_quality=8.5,
                supporting_instrument="CRISM, THEMIS, SuperCam",
                supporting_mission="MRO / Mars 2020",
                product_identifier="CRISM_FRT00005C5E / USGS SIM 3464",
                investigation_objective="Investigate lacustrine chemical precipitate carbonates as potential microbial stromatolite habitats.",
                description="Drape along the inner rim of Jezero Crater formed in shallow littoral waters during the lake's peak stand."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-07",
                name="Hogwallow Flats Siltstones",
                lon=77.4180,
                lat=18.4320,
                geological_unit="Lower Delta Mudstone Member",
                unit_symbol="fm",
                mineralogy="Fine smectite clay, minor carbonate, sulfates",
                scientific_relevance=9.2,
                mineralogical_evidence=9.0,
                data_quality=9.0,
                supporting_instrument="PIXL, SHERLOC",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="M2020_SOL_480_SAMPLING",
                investigation_objective="Characterize clay mineralogy in fine-grained sediments deposited in quiet water.",
                description="Flat-lying, very fine-grained sedimentary rock sampled by Perseverance (Bearwallow and Shulps cores)."
            ),
            ScienceTarget(
                target_id="JEZ-SCI-08",
                name="Skinner Ridge Delta Conglomerate",
                lon=77.4020,
                lat=18.4420,
                geological_unit="Upper Fan Fluvial Conglomerate",
                unit_symbol="fs",
                mineralogy="Siliciclastic boulders, igneous pebbles in sandy matrix",
                scientific_relevance=8.7,
                mineralogical_evidence=8.2,
                data_quality=8.9,
                supporting_instrument="Mastcam-Z, PIXL, SuperCam",
                supporting_mission="Mars 2020 / Perseverance",
                product_identifier="M2020_SOL_520_CONGLOMERATE",
                investigation_objective="Determine paleoflow velocity and source provenance of ancient river tributaries.",
                description="Coarse sandstone and conglomerate rock preserving evidence of high-energy braided river channels."
            )
        ]
        for t in targets_data:
            self._targets[t.target_id] = t

    def list_targets(self) -> List[ScienceTarget]:
        """Return all curated scientific exploration targets."""
        return list(self._targets.values())

    def get_target_by_id(self, target_id: str) -> Optional[ScienceTarget]:
        """Retrieve target by identifier."""
        return self._targets.get(target_id)

    def rank_targets(
        self,
        current_lon: float,
        current_lat: float,
        alpha: float = 1.0,
        beta: float = 1.0,
        gamma: float = 1.0,
        delta: float = 0.5
    ) -> List[ScienceTarget]:
        """
        Rank candidate targets according to:
        S_i = alpha * G_i + beta * M_i + gamma * Q_i - delta * H_i
        Where H_i is normalized distance cost: H_i = distance_km / 5.0.
        """
        ranked = []
        for t in self._targets.values():
            dist_m = mars_haversine_distance(current_lon, current_lat, t.lon, t.lat)
            h_cost = (dist_m / 1000.0) / 5.0 # Normalized per 5km

            score = (
                alpha * t.scientific_relevance +
                beta * t.mineralogical_evidence +
                gamma * t.data_quality -
                delta * h_cost
            )
            t.composite_score = round(score, 2)
            t.estimated_distance_m = round(dist_m, 1)
            ranked.append(t)

        ranked.sort(key=lambda x: x.composite_score, reverse=True)
        return ranked
