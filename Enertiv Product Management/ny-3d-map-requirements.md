# Requirements: NY 3D Building Map (React Prototype)

## 1. Scope

Standalone React prototype. Desktop only, light mode only, no branding. Runs locally — no deployment target for this phase. No backend, no database, no API keys, no live data feeds.

## 2. Data

Source: `25-asset-level-esg-data-NY.xlsx` — "Asset-Level Data" sheet (**30 assets** as of the 2026-08-09 update — includes 5 new Mixed-Use Residential/Commercial towers, NY-026–030, alongside the original 25 industrial assets; includes Latitude/Longitude — no geocoding needed), joined with "Baseline & Targets" (180 rows: 6 metrics × 30 assets) and, for Detail Panel display only, "Compliance Exposure (LL97)" (30 rows, one per asset — see §6.1). All confirmed correctly joined — the new assets have full data across every sheet, including a new LL97 per-sq-ft emissions-limit lookup entry for the new property type. See project log.

Baseline & Targets provides, per asset per metric: `Direction`, `Baseline Value`, `Baseline Year`, `Current Value`, `Target Value`, `Target Year`, `% Progress to Target`, `Variance vs Target`, and a precomputed `Status` (Target Met / On Track / At Risk / Off Track — not used for color, see §5.1, but available for the Detail Panel).

`Number of Floors` column added and confirmed populated for all 30 assets. Range is 1–25 — see §3 for how this drives column height.

Data prep is a one-time manual script (xlsx + baseline sheet → `buildings.geojson`), re-run manually by the requester if source data changes. Not automated, not part of the running app.

## 3. Map

- Bounded to NY State (`maxBounds` from a NY boundary file)
- Flat base map, one fixed OpenFreeMap style, no style switcher
- Buildings rendered as simple 3D columns (point-based, not real footprints)
- Column **height**: driven by `Number of Floors`, **min-max normalized** to a fixed visual height range rather than a flat linear multiplier — `height = minVisualHeight + (floors − minFloorsInData) / (maxFloorsInData − minFloorsInData) × (maxVisualHeight − minVisualHeight)`. `minFloorsInData`/`maxFloorsInData` derived dynamically from the loaded dataset (same pattern as the Floor Area slider bounds), not hardcoded. This keeps relative ordering (more floors = taller) while controlling the visual ratio between shortest and tallest columns, rather than inheriting the raw data ratio directly — needed now that the portfolio spans 1-floor warehouses to 25-floor towers. Not driven by the active performance metric — keeps height and color as two independent signals rather than double-encoding the same value.
- Column **footprint size**: zoom-driven only (meters-based sizing, pixel min/max clamps), no data meaning

## 4. Building Visual Encoding

Each building carries two independent visual signals:

1. **Fill color** — performance metric gradient (see §5.1). Reserved exclusively for this.
2. **Greyscale** — binary, full grey (not blended/desaturated). If the building fails any active Data Confidence threshold, it renders fully grey regardless of its performance color. Otherwise full color.

Certification status is **not** shown visually on the map (no badges) — see §5.3, it's a visibility filter instead, and always viewable in the Detail Panel regardless of filter state.

Precedence: greyscale (confidence) overrides color when active; color reflects the selected performance metric otherwise.

## 5. Filters / Controls

### 5.1 Performance Metrics (color gradient)
Single-select dropdown — user picks one active metric at a time. **Default: ENERGY STAR Score.**

**Color style: discrete, 3–4 band thresholds** (e.g. red / yellow / green), not a continuous gradient — prioritizes at-a-glance readability over nuance.

**Clamping:** when `% Progress to Target` exceeds 100% (beat target) or goes negative (moved further from baseline), color clamps at the scale's best/worst band rather than extending beyond it.

Color logic splits into two groups, matching how the source data itself models targets:

**Baseline-trajectory metrics** (GHG Emissions, EUI, Water Use) — per-asset baseline value in a start year, reduced to a per-asset target value in a target year. Color band = clamped position along `Variance vs Target`, direction-aware per the `Direction` field. Not the sheet's precomputed `Status` — that's shown only in the Detail Panel as a summary label.

**Fixed-goal metrics** (ENERGY STAR Score, Waste Diversion Rate, Data Coverage) — a single portfolio-wide target, not a per-asset baseline trajectory. Color band = clamped distance to that one fixed target value, direction-aware. ENERGY STAR Score's fixed target of 75 also matches the real-world certification-eligibility threshold, so this isn't just a data-model convenience — it reflects how ENERGY STAR scores are actually evaluated in practice, since the score itself is already a relative/percentile number and doesn't have a meaningful "baseline year."

Only the 6 metrics with baseline coverage are selectable — same list as before, now split by group:

- **ENERGY STAR Score** (1–100) — fixed-goal
- **GHG Emissions** (Scope 1+2, combined, location-based) — baseline-trajectory; replaces the separate GH1 Scope 1 / Scope 2 Location-based split for color purposes
- **EUI** (kWh/sq ft) — baseline-trajectory; also represents EN1 Imported, since EUI = EN1 Imported ÷ Floor Area
- **Waste Diversion Rate** (WS1) — fixed-goal
- **Water Use** (WT1) — baseline-trajectory
- **Data Coverage** (%) — fixed-goal; same underlying value as the Confidence gate in §5.2, used differently: a continuous color option here vs. a pass/fail threshold there

**Not selectable for color** (no baseline exists — shown as raw values in the Detail Panel only):
- GH1 Scope 2 Market-based — optional under GRESB, no target tracked
- GH1 Scope 3 — unscored under GRESB, no target tracked
- EN1 Generated On-site, EN1 Exported — not represented by any baseline metric
- WT2 Discharge to Sensitive Waterways — separate methodology from WT1, no baseline defined

### 5.2 Data Confidence (greyscale toggle)
- Data Coverage (%) — threshold, **default 65%**
- Confidence Tier — Verified / Estimated / Missing
- Data Source
- Last Updated — <1mo / <6mo / <1yr / ≥1yr, computed relative to the current date at load time

Any active threshold missed → building rendered full grey. Binary, not graduated. Coverage defaults on at 65%; other sub-criteria default off (no filter) until the user sets them.

### 5.3 Certifications (visibility filter)
No badges or map visuals — this category only controls what's visible, same mechanism as Property Details. Each certification is its **own field**, filtered on its **actual value** rather than mere presence:
- BC1.1 – Design/Construction Certification — LEED BD+C Certified / Silver / Gold
- BC1.2 – Operational Certification — LEED O+M Certified / Silver / Gold, ENERGY STAR Certified
- BC2 – Ongoing Certification — ENERGY STAR Certified 2025

Option lists are derived dynamically from the dataset, and each field additionally offers **None** so "assets holding no BC1.1 certification" is expressible.

Because each certification is a separate field, they AND together per §5.5 — selecting BC1.1 and BC1.2 means "holds both," not "holds either." Certification status is always shown in the Detail Panel regardless of this filter's state.

ENERGY STAR Score eligibility (75+) is **not** in this category. It is a derived threshold on a performance metric, not a held credential, and is expressed as the ENERGY STAR metric's `Target Met` band under §5.4a.

### 5.4 Property Details (filter)
- City
- State
- Property Type — options derived dynamically from the dataset; now includes 6 industrial types plus **Mixed-Use Residential/Commercial**
- Floor Area (sq ft) — min/max range slider + numeric inputs, bounds **derived dynamically from the dataset's actual min/max**, not fixed round numbers

### 5.4a Performance Band (visibility filter)
Sits alongside the Performance Metric selector and hides buildings whose band, **for the currently selected metric**, isn't checked. Options are the fixed four bands from §5.1 (Target Met / On Track / At Risk / Off Track), not dataset-derived, so the option list doesn't shift when the metric changes.

Switching the metric re-targets an active band selection. Metric = ENERGY STAR Score with band = Target Met is exactly the old "ENERGY STAR eligible (75+)" filter, since that band is defined as `score / 75 >= 1`.

### 5.5 Filter Composition
Three mechanisms, applied together. **One rule governs every field**, in both the visibility and confidence groups: an unset field is off, multiple values within one field OR together, and different fields AND together.

- **Visibility filters** — Property Details, Certifications, and Performance Band hide non-matching buildings. Values within one field OR (City = Brooklyn or Bronx); fields AND (City = Brooklyn AND Type = Cold Storage AND BC1.2 = LEED O+M Gold).
- **Data Confidence** never hides a building — same rule, but failing any active criterion renders the (still-visible) building full grey.
- **Performance Metric** is single-select and only controls what the color represents.

Order applied: visibility (Property Details + Certifications + Performance Band) → color (Performance Metric) → greyscale override (Confidence).

The Filter Panel is grouped by **effect** rather than by topic, in that same order, and each heading carries a `hides` / `colors` / `greys` badge — the checkbox affordance is identical across all three mechanisms, so the effect has to be stated. A persistent readout (`Showing 12 of 30 · 4 greyed`) makes the AND-across-fields behavior legible as selections are made.

**Empty state:** if active visibility filters match zero buildings, show a message overlay (e.g. "No buildings match your filters") rather than a silent empty map.

## 6. Interaction

- **Hover**: popup with address + the currently-selected performance metric + confidence tier
- **Click**: opens a side panel with full detail — all performance metrics, certification status, confidence breakdown, and compliance exposure (see §6.1)
- **Search**: by building name, address, or Asset ID; case-insensitive substring match
- **Legend**: static key for the active color scale, not interactive

### 6.1 Compliance Exposure (Detail Panel addition)

New data, Detail Panel only — no map, filter, color, or visibility changes. Sourced from the new "Compliance Exposure (LL97)" sheet (30 rows, joined on Asset ID, same as Baseline & Targets).

Fields shown per asset:
- LL97 Applicable
- Current Annual Emissions, Scope 1+2 (mtCO2e)
- 2024–2029 Emissions Limit (mtCO2e) and Over/(Under) Cap
- Estimated Fine Exposure 2024–2029 ($)
- 2030–2034 Emissions Limit (mtCO2e) and Projected Over/(Under) Cap
- Projected Fine Exposure 2030–2034 ($)
- LL84 Filing Status (Filed / Filed – Late / Not Filed)
- LL84 Next Filing Deadline
- Days to Deadline — static value from the sheet, not recomputed (accepted for this prototype; will drift stale over time, not a concern for now)
- Non-Filing Penalty Rate ($/sq ft/month if unfiled)
- Other NYC Local Laws Applicable
- Compliance Status 2024–2029 and 2030–2034 (Projected) — Compliant / At Risk / Non-Compliant, precomputed in the sheet

The per-property-type emissions-limit lookup table (mtCO2e/sq ft, by property type) that the sheet uses to derive each asset's limit doesn't need separate display — the resolved per-asset limit values are already in the row.

## 7. Out of Scope (this phase)

- Live data feeds / API integration
- Authentication
- Backend or database
- Multi-state support
- Style switching, dark mode, branding
- Mobile/responsive layout
- Automated data pipeline / scheduled rebuilds
- Real building footprints (points/columns only)

## 8. Open Items

- Confirm the 5 non-baseline metrics (EN1 Generated/Exported, GH1 Scope 2 Market-based, GH1 Scope 3, WT2 Discharge) belong in the Detail Panel only, with no plan to add baselines for them later
- Confirm the portfolio scope expansion (5 Mixed-Use Residential/Commercial towers added alongside the original industrial portfolio) is intentional going forward, since it's a departure from the industrial-portfolio framing in the original persona/priorities docs — doesn't block the build, but worth a conscious confirmation
- Pick actual `minVisualHeight`/`maxVisualHeight` values for the column height normalization (§3) — not yet specified numerically, just the formula
- Minor: `Last Updated` dates only span Jan–Jul 2026, so the Confidence filter's "≥1yr" freshness bucket has no data to demo — not blocking, worth knowing
- Minor: certification value strings aren't fully consistent across columns (e.g. "ENERGY STAR Certified" in BC1.2 vs "ENERGY STAR Certified 2025" in BC2). Now that §5.3 filters on the values themselves these strings surface directly as checkbox labels. They sit in different fields so there's no matching collision, but the labels read a little oddly side by side — worth a cleanup pass in the source sheet
- Minor: BC2 has only one distinct value in the dataset, so its multi-select renders as a single checkbox plus None. Correct, just sparse

## 9. Spreadsheet Fix History

`Baseline & Targets` sheet, `Target Value` column — all three fixed-goal metrics had entry errors that made every asset show the same `Status`. **Fixed and confirmed correct as of 2026-08-09**:

| Metric | Was | Now | Why |
|---|---|---|---|
| ENERGY STAR Score | `0.75` for all 25 rows | `75` | Baseline/current are on a 1–100 scale; target must match |
| Data Coverage | `75` for all 25 rows | `0.75` | Baseline/current are decimal fractions (0–1); target must match |
| Waste Diversion Rate | `0` for all 25 rows | `0.75` | No target had been entered; matches the sheet's own fabricated-assumptions note |

## 10. Engineering Decisions (not requiring further sign-off)

Plumbing choices made directly rather than raised as open questions — flag if any should be reconsidered:

- **Data prep script**: Python (`openpyxl`), one script, reads both xlsx sheets and writes `buildings.geojson`
- **Build tool**: Vite + JavaScript (not TypeScript) — minimal setup appropriate for a static prototype
- **Mapping stack**: `maplibre-gl` (v6.x) + `deck.gl` v9.x (`@deck.gl/react`, `@deck.gl/layers`, `@deck.gl/mapbox`), composited via `MapboxOverlay` in non-interleaved mode (`interleaved: false`) — simplest integration path, no need for draw-order control against base map labels at this stage
- **NY boundary source**: US Census Bureau 2023 Cartographic Boundary File, State layer, 1:500,000 scale (`cb_2023_us_state_500k`, from census.gov/geographies/mapping-files), filtered to STATEFP 36, converted to GeoJSON as part of data prep
- **State management**: React Context for shared filter/search/selected-metric state across FilterPanel, MapView, Legend, HoverPopup, DetailPanel
- **Direction handling**: normalized once at data-prep time — each building's `buildings.geojson` record carries a pre-computed, direction-adjusted, clamped color value per metric, so render-time code never branches on `Direction`
- **Number formatting**: thousands separators for large values, 1 decimal place for percentages, unit suffixes matching the sheet's stated units
- **Last Updated freshness**: computed relative to the browser's current date at load, not a fixed reference date
