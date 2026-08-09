# System Design: NY 3D Building Map (React Prototype)

## 1. Requirements

**Functional**
- Interactive map bounded to New York State
- Flat base map; only owned buildings render in simple 3D
- Each building tied to an address, resolved to a map coordinate
- Building visual size/detail adapts across zoom levels
- Building color driven by a data property
- Basic map styling options (e.g. light/dark or minimal/detailed base style)

**Non-functional / constraints**
- No API keys
- No backend, no database
- Static data file(s) only, loaded by the React app
- Free/open-source libraries only
- Prototype scope, not production-hardened

## 2. Library Selection

| Option | Fit | Key required | License |
|---|---|---|---|
| **MapLibre GL JS** | Vector tile base map, WebGL, active fork of Mapbox GL JS pre-license-change | No | BSD-3 |
| Mapbox GL JS | Same tech, but requires an account/token even on the free tier | Yes | Proprietary |
| Leaflet | Simple, DOM-based, no native 3D support | No | BSD-2 |
| Cesium | Full 3D globe/terrain — overkill for a flat, state-bounded map | No (self-hosted) | Apache 2.0 |
| Three.js (no basemap lib) | Reimplements map projection/tiling from scratch | No | MIT |
| **deck.gl** | WebGL layer framework, composites on top of MapLibre, good for extruding points into 3D shapes | No | MIT |

**Recommendation:** MapLibre GL JS for the base map, tiles from **OpenFreeMap** (free vector tiles, no key, several prebuilt styles), plus **deck.gl**'s `ColumnLayer` for the buildings, composited via `@deck.gl/mapbox`'s `MapboxOverlay`.

Buildings are known only as addresses/points, not footprint polygons, so a MapLibre `fill-extrusion` layer (which extrudes real building outlines) isn't a fit. deck.gl's `ColumnLayer` extrudes a simple shape at a point — closer to "simple 3D representation" and doesn't need footprint geometry.

## 3. Architecture Overview

```
┌────────────────────────────────────────────┐
│                 React App                    │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  MapView component                       │ │
│  │                                           │ │
│  │  react-map-gl/maplibre <Map>              │ │
│  │   - fixed OpenFreeMap style               │ │
│  │   - maxBounds = NY bbox                   │ │
│  │                                           │ │
│  │   + DeckGL overlay (MapboxOverlay,         │ │
│  │     interleaved: false)                    │ │
│  │      - ColumnLayer (buildings: color +     │ │
│  │        greyscale, height = floor count)    │ │
│  │      - GeoJsonLayer (NY boundary)          │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  FilterPanel (metric / confidence /           │
│    certification / property-detail filters)   │
│  SearchBox (name / address / Asset ID)         │
│  Legend (static key, non-interactive)          │
│  HoverPopup (address + active metric + tier)   │
│  DetailPanel (full record, opens on click)     │
│  EmptyStateOverlay (zero-match message)        │
└────────────────────────────────────────────┘
         ▲                        ▲
         │                        │
  buildings.geojson       ny-state-boundary.geojson
   (public/data/)              (public/data/)
```

No server, no database — both files are static assets fetched by the app. No style switcher — one fixed OpenFreeMap style, per confirmed styling requirements. No certification badge layer — certifications are a visibility filter, not a map visual (see §7/§8).

Shared state (active performance metric, active filters, search query, selected building) lives in a React Context, read by MapView, FilterPanel, Legend, HoverPopup, and DetailPanel alike.

## 4. Data Model

**buildings.geojson** — FeatureCollection, Point geometries, built from `25-asset-level-esg-data-NY.xlsx`'s "Asset-Level Data" sheet (**30 assets** as of the 2026-08-09 update — 25 original industrial assets plus 5 new Mixed-Use Residential/Commercial towers, NY-026–030) joined with the "Baseline & Targets" sheet (180 rows: 6 metrics × 30 assets). All sheets confirmed correctly joined for the new assets too — full data across every column, no gaps.

Per feature, carried over from Asset-Level Data: Asset ID, Asset Name, Address, City, State, Zip, Property Type (7 distinct values now, including Mixed-Use Residential/Commercial), Floor Area, **Number of Floors** (range 1–25 — see §7 for how this drives height), all EN1/EUI/GH1/WT1/WT2/WS1 raw values, BC1.1/BC1.2/BC2 certification status, ENERGY STAR Score, **12-Month Whole-Building Data Complete**, Data Coverage %, Confidence Tier, Data Source, Last Updated.

`energyStarEligible` is derived at prep time as `score >= 75 AND twelveMonthDataComplete` — two independent gates, neither of them Data Coverage %. See requirements doc §5.6.

Plus, joined in per baseline-covered metric (6 of them — see requirements doc §5.1): `Direction`, `Baseline Value`, `Current Value`, `Target Value`, `% Progress to Target`, `Variance vs Target`, plus a **pre-computed, direction-adjusted, clamped color band** (0–1 or discrete band index) per metric, so render-time code never has to branch on `Direction` or handle the >100%/negative clamping itself.

Plus, joined in from "Compliance Exposure (LL97)" (30 rows, Detail Panel display only — no effect on map/color/filters): LL97 Applicable, Current Annual Emissions, both compliance-period limits/over-cap/fine-exposure figures, LL84 Filing Status, LL84 Next Filing Deadline, Days to Deadline (carried over as-is, static — not recomputed for this prototype), Non-Filing Penalty Rate, Other NYC Local Laws Applicable, both Compliance Status fields. Includes a new LL97 per-sq-ft emissions-limit lookup entry for Mixed-Use Residential/Commercial, already resolved into each new asset's row — no lookup logic needed in the app.

**ny-state-boundary.geojson** — single Polygon/MultiPolygon for the NY state outline, sourced from the US Census Bureau's 2023 Cartographic Boundary File, State layer, 1:500,000 scale (`cb_2023_us_state_500k`), filtered to STATEFP 36.

## 5. Data Preparation (offline, one-time)

A small Python script (`openpyxl`) run ahead of time, not part of the running app. Latitude/longitude are already present in the source xlsx, so no geocoding step is needed:

1. Read `25-asset-level-esg-data-NY.xlsx` ("Asset-Level Data" sheet, 30 rows including `Number of Floors` and `12-Month Whole-Building Data Complete`).
2. Read the "Baseline & Targets" sheet, pivot from long format (one row per asset per metric) to one baseline record per asset, keyed by metric name.
3. Read the "Compliance Exposure (LL97)" sheet, one row per asset already.
4. Join all three on Asset ID.
5. Compute the direction-adjusted, clamped color band per baseline metric per asset (see §4), splitting logic by the two target types (baseline-trajectory vs fixed-goal — see requirements doc §5.1).
6. Write `buildings.geojson`.
7. Download `cb_2023_us_state_500k` from census.gov/geographies/mapping-files, filter to STATEFP 36, convert to GeoJSON, save as `ny-state-boundary.geojson`.
8. Drop both into `public/data/`.

Static dataset for this phase — re-run manually if the source xlsx changes; no automated pipeline.

A second one-time script, `scripts/add_twelve_month_column.py`, added the `12-Month Whole-Building Data Complete` column and its Legend & Notes entry. It edits the sheet XML inside the xlsx zip rather than using openpyxl: the workbook holds ~1,400 formulas *and* the cached results that `prepare_data.py` reads via `data_only=True`, and openpyxl can round-trip only one of the two — saving with `data_only=True` replaces formulas with values, saving without it drops every cached result and leaves the prep script reading `None`. Both edits are independently idempotent and the script backs the workbook up before its first write.

## 6. Zoom-Level Handling

Same visual treatment doesn't work at a state-wide zoom and a street-level zoom — points collapse into nothing zoomed out, and pixel-sized columns look wrong zoomed in. Column **footprint** size handles this; column **height** is separate (see §7).

- Size the `ColumnLayer` footprint in real-world meters, not pixels: fixed `getRadius` (e.g. 40m), with `radiusMinPixels` (~3) and `radiusMaxPixels` (~40) so columns shrink to a visible dot zoomed out and cap out zoomed in rather than filling the screen.
- Optional: gate the `ColumnLayer` behind a minzoom (~8) and fall back to a plain `ScatterplotLayer` below it, so the state-wide view isn't rendering hundreds of 3D columns at once.
- If the portfolio grows well beyond a few hundred points, add clustering (`supercluster`, free) at low zoom — not needed at current scale, noted for later.

## 7. Visual Encoding

Three independent layers, applied in order:

1. **Visibility** (Property Details + Certifications + Performance Band filters) — city/state/type/floor-area, plus BC1.1/BC1.2/BC2 and the selected metric's band. ENERGY STAR eligibility is **not** a filter — it's Detail Panel only (requirements doc §5.6). Multi-select values OR within a field, fields AND together. Non-matching buildings aren't rendered. If zero buildings match, an `EmptyStateOverlay` message renders instead of a silent empty map.
2. **Fill color** (`getFillColor`) — the currently-selected performance metric, one of the 6 with baseline coverage. Default: ENERGY STAR Score. **Discrete, 3–4 band color scale** (not continuous) for at-a-glance readability. Two color models, matching the two target types in the data:
   - **Baseline-trajectory** (GHG Emissions combined, EUI, Water Use): band from `Variance vs Target`, direction-aware (`Direction` field), clamped at the scale's endpoints for >100%/negative progress.
   - **Fixed-goal** (ENERGY STAR Score, Waste Diversion Rate, Data Coverage): band from distance to a single portfolio-wide target value, direction-aware, same clamping. Now produces meaningful variation since the spreadsheet's `Target Value` fix (requirements doc §9).
   
   Metrics without baseline coverage aren't offered in this selector — they remain visible only in the Detail Panel.
3. **Greyscale override** — computed client-side: Data Confidence sub-criteria (coverage %, tier, source, freshness — default coverage threshold 65%) combine with AND; failing any active one overrides `getFillColor` to a fixed, fully-grey color (not a blend). Never affects visibility, only color.

**Column height** (`getElevation`) is separate from all three layers above — driven by `Number of Floors`, **min-max normalized** to a fixed visual height range rather than a flat linear multiplier:

```
height = minVisualHeight + (floors - minFloorsInData) / (maxFloorsInData - minFloorsInData) * (maxVisualHeight - minVisualHeight)
```

`minFloorsInData`/`maxFloorsInData` computed at data-prep time from the actual dataset (same pattern as the Floor Area filter bounds), not hardcoded — so it still works correctly if the portfolio's floor-count range changes later. `minVisualHeight`/`maxVisualHeight` are fixed prototype constants, not yet numerically pinned (see requirements doc §8). Needed because the portfolio now spans 1-floor warehouses to 25-floor towers (see requirements doc §2) — a flat multiplier would let the towers visually dominate the map at the expense of the rest of the portfolio being barely visible. Not driven by any filter or the active metric — keeps height and color independent rather than double-encoding the same value.

A `Legend` component reads the same color-band function as the map so the key always matches, and stays static (no click-to-filter).

## 8. Filtering, Search, and Detail

- **FilterPanel**: performance-metric select (single active metric), confidence-threshold controls (coverage %, tier, source, freshness), certification checkboxes (now a visibility filter, not a badge toggle), property-detail filters (city, state, property type, floor-area min/max — bounds derived dynamically from the loaded dataset). Filtering recomputes which `ColumnLayer` data points are visible/greyed, not a separate data fetch — all filtering happens client-side against the already-loaded `buildings.geojson`.
- **SearchBox**: case-insensitive substring match against name, address, or Asset ID; pans/zooms to the match.
- **HoverPopup**: address + the active performance metric's value + confidence tier.
- **DetailPanel**: opens on click, full record — all metrics (including the 5 without baseline coverage), certification status, confidence breakdown, and a Compliance Exposure section (LL97/LL84 fields — see requirements doc §6.1; `Days to Deadline` shown as the sheet's static value, not recomputed). Number/percent formatting: thousands separators for large values, 1 decimal place for percentages, unit suffixes matching the sheet's stated units.
- **EmptyStateOverlay**: renders when active visibility filters match zero buildings.

## 9. React App Structure

```
src/
  components/
    MapView.jsx        # MapLibre + deck.gl composition
    FilterPanel.jsx
    SearchBox.jsx
    Legend.jsx
    HoverPopup.jsx
    DetailPanel.jsx
    EmptyStateOverlay.jsx
  context/
    MapStateContext.jsx # shared filter/search/selected-metric/selected-building state
  data/
    colorScale.js       # shared color-band function (baseline-aware, two-model, clamped)
public/
  data/
    buildings.geojson
    ny-state-boundary.geojson
scripts/
  prepare_data.py       # xlsx -> buildings.geojson (Python, openpyxl)
```

Build tool: **Vite + JavaScript** (not TypeScript) — minimal setup for a static prototype.

Key packages: `maplibre-gl` (v6.x), `react-map-gl` (or `@vis.gl/react-maplibre`), `deck.gl` v9.x (`@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/mapbox`), composited via `MapboxOverlay` with `interleaved: false`.

## 10. Trade-offs / Revisit Later

- Columns are a stylized stand-in for buildings, not their true footprint or shape. Real footprints would need per-building polygon data (e.g. matched against OSM's building layer by address) if visual fidelity matters later.
- Column height uses min-max normalization rather than raw floor count, specifically to keep the 5 new high-rise towers from visually dominating the rest of the (mostly low-rise industrial) portfolio.
- Static files mean no live updates — a portfolio change requires re-running data prep manually (accepted for this phase).
- `maxBounds` keeps the camera inside NY, but the base map still renders neighboring states in view — no hard visual cutoff. A boundary mask layer can be added if that's wanted.
- Desktop-only, light-mode-only, no responsive layout — accepted for this phase; would need rework to support mobile or dark mode later.
- Portfolio now includes non-industrial assets (5 Mixed-Use Residential/Commercial towers) — a scope departure from the original industrial-portfolio framing; doesn't affect this design since Property Type, Certifications, and Confidence filters are all data-driven rather than hardcoded to industrial categories, but worth a conscious confirmation (requirements doc §8).

## 11. Next Steps

- Pin exact `minVisualHeight`/`maxVisualHeight` values for the column height formula (§7) — currently just a formula, not concrete numbers
- Build the data prep script, generate a first `buildings.geojson` from the xlsx
- Scaffold `MapView` with a handful of test points before wiring the full dataset
- Build `FilterPanel` and `colorScale.js` together, since filter state and color state share the same baseline-aware logic

See `ny-3d-map-requirements.md` for the full confirmed requirements this design implements.
