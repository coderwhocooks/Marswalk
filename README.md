# MARSWALK
### Martian Astronaut Route & Scientific Exploration Planner
**NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
**Target Demonstration Sector:** Jezero Crater, Mars (77.16°E – 77.70°E, 18.21°N – 18.72°N)

---

## 1. Executive Overview

**MARSWALK** transforms raw planetary observations into explainable, terrain-aware, and resource-bounded exploration plans for hypothetical human astronauts.

Rather than acting as a static Martian map, MARSWALK implements an end-to-end mission-control workspace:
```
SCIENTIFIC DATA → DATA PROCESSING → TERRAIN INTELLIGENCE → ROUTE OPTIMIZATION → MISSION SIMULATION → EXPLORATION DECISION SUPPORT
```

### Core Problems Solved:
1. **Where can an astronaut travel?**  
   Evaluates 2,413,152 topographic postings from the official USGS Mars 2020 Digital Terrain Model (20m posting) to identify traversable corridors and enforce hard slope barriers (>20°).
2. **Which routes are safest?**  
   Calculates an explainable multi-criteria cost surface balancing gradient fatigue, surface roughness, and hazard exposure against geometric distance.
3. **What geological targets are worth investigating?**  
   Indexes verified stratigraphic formations from USGS SIM 3464 and MRO CRISM spectral observations (Delta Scarp mudstones, Kodiak clinoforms, Belva Crater cross-sections, carbonate shorelines).
4. **What are the local environmental conditions?**  
   Integrates empirical diurnal surface pressure, kinetic temperature, wind vectors, and dust opacity from Perseverance MEDA records, paired with MSL RAD ionizing radiation dosimetry models.
5. **Can the mission be completed within life-support budgets?**  
   Simulates extravehicular activity (EVA) timelines and consumables drawdown (O2 mass, suit battery energy, sublimator cooling water) against a mandatory 20% abort reserve margin.
6. **What alternative routes exist?**  
   Provides multi-mode comparisons (Safe Traverse vs. Shortest Distance) with cross-sectional topographic profiles and quantifiable risk trade-offs.

---

## 2. Verified NASA & USGS Planetary Datasets

| Dataset Identifier | Instrument / Mission | Product Type | Spatial Resolution | CRS / Extent | Source & Provenance |
|---|---|---|---|---|---|
| **JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m** | Context Camera (CTX) / MRO | Digital Elevation Model (GeoTIFF) | 20.0 m/pixel | Equirectangular Mars 2000 Sphere (77.16°E–77.70°E, 18.21°N–18.72°N) | [USGS Planetary Maps](https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/) |
| **JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0** | Context Camera (CTX) / MRO | Orthorectified Image Mosaic (WMTS) | 6.0 m/pixel | Equirectangular Mars 2000 (Plate Carrée) | [NASA Mars Trek API](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) |
| **Mars_MGS_MOLA_ClrShade_merge_global_463m** | MOLA / Mars Global Surveyor | Color Hillshade / Topography | 463 m/pixel | Global Mars Sphere | [NASA Solar System Treks](https://trek.nasa.gov/) |
| **Mars_Viking_MDIM21_ClrMosaic_global_232m** | Viking Orbiter Camera | Color Controlled Mosaic | 232 m/pixel | Global Mars | [USGS Astrogeology](https://astrogeology.usgs.gov/) |
| **USGS SIM 3464** | Photogeological Synthesis | Geologic Map of Jezero & Nili Planum | 1:75,000 scale | Jezero Quadrangle | [USGS Geologic Investigations](https://doi.org/10.3133/sim3464) |
| **Mars 2020 MEDA PDS Archive** | Perseverance Rover | Direct Surface Meteorology (ATS, GTS, PS, WS, RDS) | In-situ floor measurements | Octavia E. Butler Landing (18.44°N, 77.45°E) | [PDS Geosciences Node](https://pds-geosciences.wustl.edu/m2020/) |
| **MSL RAD Surface Baseline** | Curiosity Rover RAD | Surface Ionizing Radiation Dosimetry | Continuous surface dosimetry | Gale Crater benchmark (0.64 mSv/day) | [NASA PDS](https://pds.nasa.gov/) |

---

## 3. Geospatial Correctness & Coordinate Reference System

Planetary spatial operations in MARSWALK adhere strictly to IAU 2000 Mars cartographic conventions:
- **Reference Body:** Mars Mean Sphere ($R_{\text{Mars}} = 3,396,190.0\text{ m}$).
- **Projection:** Equirectangular ($x = R \cdot \lambda \cdot \frac{\pi}{180}$, $y = R \cdot \phi \cdot \frac{\pi}{180}$) with standard parallel at the equator ($\phi_0 = 0^\circ$).
- **Coordinates:** Planetocentric latitude, East-positive longitude ($0^\circ - 360^\circ$ or $-180^\circ - +180^\circ$).
- **Vertical Datum:** MOLA Areoid Geoid.
- **Non-Negotiable Rule:** Missing data or NoData pixels are strictly non-traversable. They are never assigned a zero hazard value.

---

## 4. Algorithmic Formulation

### 4.1 Surface Slope & Roughness Derivation
Slopes are calculated from the elevation raster $Z(r, c)$ using 2D finite difference gradients:
$$\frac{\partial Z}{\partial x} = \frac{Z(r, c+1) - Z(r, c-1)}{2 \Delta x}, \quad \frac{\partial Z}{\partial y} = \frac{Z(r+1, c) - Z(r-1, c)}{2 \Delta y}$$
$$\theta(r, c) = \arctan\left(\sqrt{\left(\frac{\partial Z}{\partial x}\right)^2 + \left(\frac{\partial Z}{\partial y}\right)^2}\right) \times \frac{180^\circ}{\pi}$$
Surface roughness $R(r, c)$ is computed as the local standard deviation of elevation in a moving window via $O(N)$ uniform variance filtering:
$$\text{Var}(Z) = E[Z^2] - (E[Z])^2, \quad R(r, c) = \sqrt{\text{Var}(Z)}$$

### 4.2 A* Graph Path Planning & Cost Surface
Traverse paths are evaluated on an 8-connected grid where each step has metric length $d_{uv} = \Delta \times (1.0 \text{ if orthogonal else } \sqrt{2})$.
The non-negative edge traversal cost is defined as:
$$C(u \to v) = \begin{cases} 
\infty & \text{if } \theta(v) > \theta_{\max} \text{ or cell is NoData} \\
d_{uv} \times \left[1.0 + w_s \left(\frac{\theta(v)}{15^\circ}\right)^2 + w_r \left(\frac{R(v)}{5.0}\right)\right] & \text{otherwise}
\end{cases}$$
The A* Euclidean distance heuristic $h(u) = \text{distance}(u, \text{goal}) \le C^*(u, \text{goal})$ is strictly **admissible and consistent**, guaranteeing minimum-cost optimal paths. On benchmark grids, A* optimality has been verified against Dijkstra's algorithm to within $10^{-4}$ relative tolerance.

### 4.3 Martian Astronaut Locomotion Model
Human walking velocity under Martian gravity ($0.38g$) is computed using Tobler's hiking function calibrated for spacesuit locomotion:
$$v(s) = v_0 \cdot \exp(-3.5 \cdot |\tan(\theta) + 0.05|), \quad v_0 = 0.85\text{ m/s } (\approx 3.06\text{ km/h})$$
Walking time is integrated along each path segment: $T_{\text{walk}} = \sum \frac{d_{uv}}{v(s_{uv})}$.

---

## 5. Extravehicular Activity (EVA) Life-Support Simulation

### 5.1 Timeline Model
$$T_{\text{mission}} = T_{\text{walk}} + T_{\text{science}} + T_{\text{navigation}} + T_{\text{contingency}}$$
- $T_{\text{science}}$: Planned sampling dwell at the geological site (default 45 min).
- $T_{\text{navigation}}$: Communication, suit telemetry, and route check buffer (15 min).
- $T_{\text{contingency}}$: Configurable safety reserve margin (default 15% of nominal time).

### 5.2 Consumables Model
1. **Primary Oxygen ($O_2$):** Usable capacity 1.20 kg. High metabolic rate during walking ($0.082\text{ kg/h}$); basal rate during stationary science ($0.052\text{ kg/h}$).
2. **Suit Battery Energy:** Usable capacity 1000 Wh. Constant avionics, ventilation blower, and bio-monitor load ($175\text{ W}$).
3. **Sublimator Cooling Water:** Usable capacity 4.0 kg. Daytime vacuum sublimator heat rejection ($0.45\text{ kg/h}$).
4. **Mandatory Abort Threshold:** If any consumable reserve falls below 20%, the mission status flags **MARGINAL** or **INFEASIBLE**, providing specific reduction guidance (e.g., shortening dwell time or choosing intermediate staging).

---

## 6. Software Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MISSION CONTROL FRONTEND                        │
│          React 19 • TypeScript • Vite • OpenLayers • Tailwind CSS      │
│  [Planetary Map]  [Topographic Cross-Section]  [Telemetry & Dials]     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON / REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          FASTAPI APPLICATION                           │
│   GET /datasets      GET /layers       GET /coverage    POST /routes   │
│   GET /targets       GET /environment  POST /simulate   POST /reports  │
└───────┬──────────────┬──────────────┬──────────────┬───────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌────────────────────────┐
│  GEODESY &   ││   TERRAIN    ││    ROUTE     ││   SCIENCE, MEDA &      │
│ PROJECTIONS  ││ INTELLIGENCE ││ OPTIMIZATION ││ LIFE-SUPPORT SIMULATOR │
│ IAU 2000 Eqc ││ Slope/Rough  ││  A* Planner  ││ USGS SIM 3464, MEDA,   │
│ R=3,396,190m ││ 20m CTX DTM  ││ Dijkstra Ref ││ Consumables Drawdown   │
└──────────────┘└──────────────┘└──────────────┘└────────────────────────┘
```

---

## 7. Automated Test Suite

The project includes 34 automated unit and integration tests executed with `pytest`:

```bash
$ python -m pytest tests/ -v
============================= test session starts =============================
tests/test_api.py ...........                                            [ 32%]
tests/test_geodesy.py .....                                              [ 47%]
tests/test_router.py .....                                               [ 61%]
tests/test_science_env.py .....                                          [ 76%]
tests/test_simulator.py ...                                              [ 85%]
tests/test_terrain.py .....                                              [100%]
======================== 34 passed, 1 warning in 1.45s ========================
```

### Verified Acceptance Properties:
- **Geodetic Round-Trip:** Coordinates convert between degrees and projected meters with $<10^{-5}\text{ m}$ deviation.
- **Slope Mathematical Correctness:** Flat DEM produces $0.00^\circ$ slope; $1:1$ gradient produces $45.00^\circ \pm 0.05^\circ$.
- **NoData Non-Traversability:** Missing or flagged cells are strictly impassable.
- **A* vs. Dijkstra Optimality:** Cost surfaces solved with A* yield the identical minimum cost as Dijkstra.
- **Cost Monotonicity:** Increasing slope penalties reliably diverts the planner away from ridges.
- **Consumables Drawdown:** Simulation outputs accurately trigger marginal and infeasible status flags when safety thresholds are breached.

---

## 8. Installation & Execution

### Prerequisites
- Python 3.10+ (tested on Python 3.14)
- Node.js 18+ (tested on Node.js 24)
- npm 9+

### 1. Install Backend Dependencies
```bash
pip install -r requirements.txt
```

### 2. Verify Official USGS 20m DTM Cache
The backend automatically reads the official USGS Jezero 20m DTM:
`backend/data/raw/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif`  
(Included in repository, 9.2 MB, 2.41M elevations).

### 3. Build Frontend Application
```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Launch MARSWALK Unified Service
```bash
python -m backend.main
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser to access the complete application.

*(For active frontend development with hot-reloading, run `cd frontend && npm run dev` on `http://localhost:5173` with proxy to `:8000`).*

---

## 9. Live Demonstration Scenario Walkthrough

1. **Initialize Planetary View:**
   Navigate to `http://localhost:8000`. The map centers on the Jezero Crater Western Delta and floor using the live NASA Mars Trek 6m CTX orthomosaic basemap.
2. **Inspect Basemaps & Overlays:**
   Open the **Layers** panel. Toggle between the Jezero CTX 6m mosaic, MOLA Shaded Relief (463m), and Viking MDIM 2.1 Color (232m). Toggle the slope hazard overlay.
3. **Select Staging & Science Target:**
   - Staging: Octavia E. Butler Landing Site ($18.4447^\circ\text{N}, 77.4508^\circ\text{E}$).
   - Destination Target: Click **Hawksbill Gap (Delta Scarp)** ($18.4350^\circ\text{N}, 77.4060^\circ\text{E}$) or pick directly on the interactive map.
4. **Calculate Traverse Route:**
   Select **Safe Traverse** mode (Max slope 20°). Click **Calculate Route**.  
   The system computes the metric A* path avoiding the steep crater floor scarps and Séítah dune fields.
5. **Analyze Topographic Cross-Section:**
   Review the bottom profile chart showing elevation gain (+42m), loss (-18m), distance (2.7 km), and slope distributions. Hover along the profile to scrub specific waypoints.
6. **Compare Alternative Strategies:**
   Click **Compare Modes**. Observe the side-by-side trade-off between the direct Shortest route and the lower-risk Safe route.
7. **Inspect Local Environmental Telemetry:**
   Open the **MEDA** tab. Adjust the LMST slider across the Martian sol to view diurnal temperature swings (-18°C midday to -90°C night), atmospheric pressure (725 Pa), katabatic winds, and accumulated radiation (mSv).
8. **Simulate Life Support:**
   Open the **Support** tab. Adjust the planned science dwell time (e.g., 45 min vs. 120 min). Inspect oxygen, battery, and water drawdown bars and reserve margins.
9. **Export Expedition Briefing:**
   Click **Expedition Briefing** in the top bar. Review the complete dossier, copy the formatted Markdown report, or print the briefing.

---

## 10. Research Assumptions & Limitations

- **Human Locomotion Limits:** Spacesuit mobility thresholds (nominal maximum slope 20°) are experimental engineering assumptions based on Apollo lunar EVA and NASA Desert RATS field trials; they are not certified flight operational limits.
- **Environmental Extrapolation:** Atmospheric and weather parameters are empirically calibrated models based on Perseverance MEDA floor observations and do not represent localized micro-climates along high crater rims.
- **Ionizing Radiation:** Radiation dose rate ($0.64\text{ mSv/day}$) is derived from MSL Curiosity RAD surface measurements at Gale Crater and provides baseline GCR context rather than real-time solar particle event tracking.
- **Demonstration Scope:** The high-resolution elevation engine covers the Jezero Crater sector ($31.9\text{ km} \times 30.2\text{ km}$). Extrapolation beyond this boundary is prevented by design.
