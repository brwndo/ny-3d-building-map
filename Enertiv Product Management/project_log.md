# Project Log

## 2026-08-07 14:36 UTC — Design exercise plan created
Broke the Enertiv ESG dashboard design exercise into a 5-phase plan (research, user framing, rough wireframes, high-fidelity mockups, writeup) and split each phase into its own standalone chat thread prompt.

## 2026-08-07 14:47 UTC — User persona and journey built
Analyzed Enertiv's site to identify key audiences and platform features, then built out an ESG dashboard user persona, prioritized metrics list, and 4-phase trust/audit user journey for a sustainability/ESG officer audience.

## 2026-08-07 15:10 UTC — ESG framework & compliance research compiled
Researched GRESB (single-building and portfolio-level rollup), ENERGY STAR Portfolio Manager, LEED O+M, GHG Protocol Scope 1/2/3, NYC Local Law 97 and comparable BPS laws in other jurisdictions, single-building manager workflows, and portfolio-level LP/investor reporting cadence for a NY-based industrial asset manager. Output: `4-research-esg-frameworks-compliance.md`, added to project files.

## 2026-08-07 19:18 UTC — Portfolio Asset Visualization — Interaction Pattern Brainstorm
Brainstormed and finalized the core interaction patterns for the portfolio map view — map-as-spine layout, compliance/completeness visual encoding, Search vs. Agent asset-finding split, Agent thread/undo behavior, Report-based persistence, and drawer-based detail view — captured in full in portfolio-visualization-brainstorm-summary.md.

## 2026-08-07 (later same session) — Portfolio vs. asset metrics diagrammed, and dashboard data model prototyped
Diagrammed primary portfolio-level (GRESB score) vs. asset-level (ENERGY STAR score) metrics; expanded the GRESB score into its Management + Performance components; clarified that compliance exposure and the Transition Risk Report are downstream outputs, not scored GRESB inputs; clarified Performance data aggregation rules (sum vs. floor-area/GAV-weighted average); confirmed Management is entity-level only, not an asset-level rollup. Built fake-data dashboard prototype in `25-asset-level-esg-data-NY.xlsx`: an Asset-Level Data tab (25 NY industrial assets, EN1/GH1/WT1/WS1/BC, formula-driven EUI and Scope 2, floor-area-weighted portfolio summary), a Management (Entity-Level) tab (26 indicators across five Management aspects with evidence, ownership, and review dates), and a Legend & Notes tab.

## 2026-08-07 21:33 UTC — UI/UX skill installed in Cursor
Installed the ui-ux-pro-max skill (https://www.skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max) into Cursor to assist with UI building and UX decisions, marking the start of the UI build phase.

## 2026-08-09 15:56 UTC — Spreadsheet fix verified
Confirmed the 3 Target Value fixes (ENERGY STAR 75, Data Coverage 0.75, Waste Diversion 0.75) are in and correct - all 6 metrics now show real status variety across the 25 assets, row/asset counts intact, no data loss from the edit.

## 2026-08-09 15:56 UTC — Remaining build-readiness questions resolved
Worked through the rest of the pre-build question list. Key decisions: column height driven by a new Number of Floors column (not the active metric, to avoid double-encoding with color) - Clear Height was proposed as an alternative given this portfolio is mostly single-story industrial, but Number of Floors was kept. Confidence failure renders full grey. Color uses discrete 3-4 band thresholds, clamped at scale endpoints beyond 100%/negative progress. Certification badges dropped from the map entirely (after an initial back-and-forth) - certifications are now a visibility filter like Property Details, not a map visual. Floor Area slider bounds are dynamic from the dataset. Empty filter results show a message overlay. Engineering plumbing (Python data-prep script, Vite+JS, deck.gl v9/maplibre-gl v6 via non-interleaved MapboxOverlay, React Context for shared state, Census cb_2023_us_state_500k for the NY boundary, direction-normalization at prep time) decided directly rather than raised as questions. Both docs fully updated to reflect final build-ready spec.

## 2026-08-09 16:49 UTC — Number of Floors added; portfolio expanded to 30 assets
Spreadsheet update intended to add Number of Floors also added 5 new assets (NY-026-030) - Mixed-Use Residential/Commercial towers, 8-25 floors - fully integrated across Asset-Level Data, Baseline & Targets (now 180 rows), and Compliance Exposure (new LL97 lookup entry for the new property type), all confirmed clean. Flagged the scope change (portfolio no longer purely industrial) for awareness. Floor count range (1-25) also invalidated the earlier "low variance, flat multiplier is fine" assumption - a raw linear height mapping would let the 5 towers visually dominate the rest of the portfolio. Resolved by min-max normalizing floor count to a fixed visual height range instead of a flat multiplier, with min/max derived dynamically from the dataset. Exact visual height bounds still need to be pinned as concrete numbers. Both docs updated.
