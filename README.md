# NY 3D Building Map

Standalone React prototype: an interactive 3D column map of a 30-asset NY real
estate portfolio, colored by ESG performance metrics and greyed out where data
confidence checks fail. Desktop only, light mode, no backend, no API keys.

Spec: `Enertiv Product Management/ny-3d-map-requirements.md` and
`ny-3d-map-system-design.md`.

## Run

```bash
npm install
npm run dev
```

Data files are pre-generated in `public/data/`. The app loads them statically.

## Regenerating data

When `Enertiv Product Management/25-asset-level-esg-data-NY.xlsx` changes:

```bash
python3 -m venv .venv
.venv/bin/pip install openpyxl pyshp
.venv/bin/python scripts/prepare_data.py
```

The script reads three sheets (Asset-Level Data, Baseline & Targets, Compliance
Exposure (LL97)), joins on Asset ID, precomputes the direction-adjusted clamped
color band per metric per asset, and writes `public/data/buildings.geojson`.
It also prints a verification diff of computed bands vs the sheet's Status
column.

The NY boundary comes from the US Census `cb_2023_us_state_500k` shapefile
(State layer, filtered to STATEFP 36). If `scripts/source/cb_2023_us_state_500k.shp`
is present, the script regenerates `public/data/ny-state-boundary.geojson` too:

```bash
mkdir -p scripts/source
curl -fsSL -o scripts/source/cb_2023_us_state_500k.zip \
  "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip"
unzip -o -d scripts/source scripts/source/cb_2023_us_state_500k.zip
```

## Visual encoding

- **Color** — the selected performance metric (default ENERGY STAR Score), in 4
  discrete bands: Off Track / At Risk / On Track / Target Met. Thresholds are
  0.40 / 0.75 / 1.0 on the normalized progress value `p`, matching the sheet's
  own Status logic. Trajectory metrics (GHG, EUI, Water) use clamped
  `% Progress to Target`; fixed-goal metrics (ENERGY STAR, Waste Diversion,
  Data Coverage) use clamped distance to the portfolio-wide target.
- **Grey** — binary override when a building fails any active Data Confidence
  check (coverage threshold, tier, source, freshness). Never hides a building.
- **Height** — number of floors, sqrt-normalized between 150 m and 1200 m so
  the 1–3 floor industrial assets stay distinguishable next to the 8–25 floor
  towers. Independent of the active metric.

## Stack

Vite + JavaScript, React 19, MapLibre GL v6 (OpenFreeMap Positron style),
deck.gl v9 `ColumnLayer` via `MapboxOverlay` (non-interleaved), React Context
for shared filter/search/selection state.
