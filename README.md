# NY 3D Building Map

Standalone React prototype: an interactive 3D column map of a 30-asset NY real
estate portfolio, colored by ESG performance metrics and greyed out where data
confidence checks fail. Desktop only, light mode, no backend, no API keys.

Spec: `Enertiv Product Management/ny-3d-map-requirements.md` and
`ny-3d-map-system-design.md`.

Live: https://brwndo.github.io/ny-3d-building-map/

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
column, plus the ENERGY STAR eligibility split.

`scripts/add_twelve_month_column.py` is a separate one-time script that added
the `12-Month Whole-Building Data Complete` column to the workbook. It is
idempotent and already applied — you only need it if the column is ever lost.
It rewrites the sheet XML inside the xlsx directly, because the workbook is
formula-driven and openpyxl cannot preserve formulas and their cached results
at the same time.

The NY boundary comes from the US Census `cb_2023_us_state_500k` shapefile
(State layer, filtered to STATEFP 36). County boundaries come from
`cb_2023_us_county_500k` (same filter). If the shapefiles are present under
`scripts/source/`, the script also regenerates `public/data/ny-state-boundary.geojson`
and `public/data/ny-counties.geojson`:

```bash
mkdir -p scripts/source
curl -fsSL -o scripts/source/cb_2023_us_state_500k.zip \
  "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_500k.zip"
unzip -o -d scripts/source scripts/source/cb_2023_us_state_500k.zip

curl -fsSL -o scripts/source/cb_2023_us_county_500k.zip \
  "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip"
unzip -o -d scripts/source scripts/source/cb_2023_us_county_500k.zip
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
- **Map dot size** — floor area (sq ft), sqrt-normalized so mid-size assets stay
  readable next to the largest towers. Independent of the active metric.
- **Iso column height** — number of floors, sqrt-normalized between stylized
  scene units so 1–3 floor industrial assets stay distinguishable next to
  8–25 floor towers.

ENERGY STAR certification eligibility is Detail Panel only — no map or filter
role. It requires both a score of 75+ and a complete 12-month whole-building
data year, which is a separate column from Data Coverage %.

## Stack

Vite + JavaScript, React 19, MapLibre GL v6 (OpenFreeMap Positron, Ultra Light styling),
deck.gl v9 `ColumnLayer` via `MapboxOverlay` (non-interleaved), React Context
for shared filter/search/selection state.
