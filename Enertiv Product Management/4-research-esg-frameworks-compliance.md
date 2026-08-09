# Research: ESG Frameworks, Compliance, and Reporting for Industrial Real Estate

Compiled to inform the ESG dashboard design. Covers both the single-building data model and the portfolio-level (asset manager) rollup, since the dashboard needs to support both a property manager and a portfolio-level ESG/sustainability officer.

---

## 1. GRESB

### Single-building / asset level
GRESB (Global Real Estate Sustainability Benchmark) is a portfolio/entity-level assessment, not a single-building certification, but portfolio scores are built entirely from asset-level submissions.

The Real Estate Assessment has three components, each independently scored and rolled into the overall GRESB Score and Rating:
- **Management** — strategy, leadership, policy, risk management, stakeholder engagement. Reported at the organizational level, not per building.
- **Performance** — asset- and portfolio-level energy, GHG, water, and waste data. This is where single-building data enters the assessment.
- **Development** — sustainability practices during design, construction, and renovation (not relevant to standing/operating industrial assets).

A portfolio reporting only Management + Performance is scored against the "Standing Investments" benchmark — the relevant track for an owner/operator with no active development pipeline.

**The core asset-level indicators that funnel into portfolio scores:**

| Indicator | Code | What's reported per building |
|---|---|---|
| Energy | EN1 | Total energy imported/purchased, generated on-site, exported/sold |
| GHG Emissions | GH1 | Scope 1, Scope 2 (location-based mandatory, market-based optional), Scope 3 (unscored) |
| Water | WT1 / WT2 | Total withdrawals/inflows; discharge to sensitive waterways |
| Waste | WS1 | Diversion and recycling performance |
| Building Certifications | BC1.1, BC1.2, BC2 | Certification status (design/construction, operational, and ongoing) |

GRESB aggregates these into a single portfolio score weighted by gross asset value (GAV) per property sub-type and country. Asset-level data submitted to GRESB is confidential — used only to validate the aggregated portfolio figures, and not passed to investors in a way that's traceable back to a specific building without the participant's consent.

**Data coverage is now a scored metric in its own right** (added prominence starting with the 2025 Standard), alongside GHG assurance/verification status — directly aligned with the "can I trust this number" concern that anchors the dashboard's design.

**2026 methodology note relevant to industrial/NNN portfolios:** landlord-controlled tenant space emissions are being reclassified from Scope 3 to Scopes 1/2 under the 2026 Standard. This changes how tenant-controlled meter data in triple-net buildings should be categorized and is worth flagging in the dashboard's emissions logic.

Where data coverage varies across energy types at one asset (e.g., partial submetering), GRESB permits an equal-contribution assumption across the missing types — a specific gap-filling convention the dashboard could mirror or expose as an option.

### Portfolio level
- The 2026 Standard's indicator retirements and reweighting are expected to move Standing Investments scores by roughly -4 to +2.85 points, averaging about -0.6 points — useful context for explaining year-over-year score movement that isn't due to actual performance change.
- Participants typically see a 10-point score increase in their second year of reporting, largely reflecting improved data coverage and process maturity rather than operational change — worth surfacing as an expectation-setting note for portfolio leadership.
- Building certifications are an area GRESB has been deliberately expanding in scoring weight since a multi-year plan initiated in 2022.

---

## 2. ENERGY STAR Portfolio Manager

The primary energy-benchmarking tool at the single-building level, and a direct data source for GRESB's EN1.

- Score scale: 1–100, percentile-based. A score of 50 means the building outperforms 50% of its peer group; 75+ is top quartile and the threshold for ENERGY STAR certification eligibility.
- Peer comparison is by primary use, drawn from EPA's national CBECS survey (updated roughly every 5–7 years) — not a comparison against other Portfolio Manager users.
- Eligibility requires whole-building metering across all fuel types, with at least 12 full consecutive months of data per active meter.
- Manufacturing plants (as opposed to general warehouses) use separate industry-specific Energy Performance Indicators rather than the general 1–100 score — worth checking which applies per building depending on actual use type.
- Beyond the score, Portfolio Manager also tracks water, waste/materials, and emissions, and supports target-setting against a baseline, a percent-better-than-median goal, or a target score.

---

## 3. LEED (Operations & Maintenance)

Relevant rating system for existing, occupied buildings.

- Eligibility: whole buildings/interior spaces occupied and operational for at least one year.
- Certification levels (100-point scale, 110 points available): Certified 40–49, Silver 50–59, Gold 60–79, Platinum 80+.
- Requires a minimum 12-month performance period collecting energy, water, waste diversion, and occupant satisfaction data as the evidentiary basis for credits.
- **Recertification cadence:** LEED O+M certifications expire — 3 years under LEED v4.1/v5, historically up to 5 years under some v4 pathways. Unlike BD+C/ID+C certifications (which don't expire), O+M requires ongoing operational discipline to maintain status.
- LEED v5 launched April 2025; v4/v4.1 commercial registration has been extended to June 30, 2027, so multiple active versions coexist in the market.

Dashboard implication: track certification level, expiration date, rolling 12-month performance-period completeness, and the recertification submission window per building.

---

## 4. GHG Protocol — Scope 1/2/3

- **Scope 1:** direct emissions from owned/controlled on-site sources — e.g., natural gas combustion in owned boilers/furnaces, fleet vehicles.
- **Scope 2:** indirect emissions from purchased electricity, steam, heat, or cooling generated off-site. Estimated to represent at least a third of global GHG emissions, making it a high-value tracking category.
- **Scope 3:** all other value-chain emissions. For a single building, tenant-purchased electricity in a multi-tenant/NNN property is often allocated to Scope 3 under a commonly used operational-control boundary — but the correct categorization depends on lease structure and the organizational boundary chosen (and, per the GRESB note above, this classification is shifting for landlord-controlled tenant space).
- Scope 1 and 2 reporting is generally mandatory where required by law; Scope 3 remains largely voluntary today but is trending toward required status under frameworks like the EU's CSRD.

Dashboard implication: build a clean Scope 1/Scope 2 module first (on-site combustion, purchased electricity, with both location-based and market-based views for Scope 2), and treat Scope 3 (tenant energy, materials, waste) as a secondary, boundary-dependent layer — with the lease structure flagged as a variable that changes what counts as Scope 2 vs. Scope 3.

---

## 5. Benchmarking and building performance standard (BPS) laws

Distinction to carry through the dashboard: **benchmarking laws** require measurement and disclosure only; a **BPS** sets a binding performance target with financial penalties for missing it. Most jurisdictions start with benchmarking and layer a BPS on top over time. As of 2026, roughly 16 active BPS laws exist across U.S. cities, counties, and states, with total fines increasing by an average of 82% between the first and second compliance periods (JLL research) — a strong argument for early, dashboard-driven exposure tracking rather than reactive compliance.

### New York City (primary jurisdiction for this portfolio)
| Law | Requirement | Deadline / penalty |
|---|---|---|
| Local Law 84 | Annual energy & water benchmarking via Portfolio Manager, buildings 25,000+ sq ft | May 1 annual deadline; $500/quarter late-filing penalty |
| Local Law 87 | ASHRAE Level 2 energy audit + retro-commissioning | Every 10 years |
| Local Law 88 | Lighting upgrades and tenant submetering | — |
| Local Law 33 | A–F energy-efficiency letter grade displayed at building entrance | Based on ENERGY STAR score |
| Local Law 97 | Carbon emissions caps, buildings 25,000+ sq ft (~50,000 buildings, ~40% of city building stock) | $268/metric ton CO2e over the cap; $0.50/sq ft/month for non-filing; up to $500,000 for false statements |

LL97 compliance-period structure: buildings must complete work to meet the 2024–2029 limit by May 1, 2026, and have DOB-approved work plans in place by May 1, 2028 for the stricter 2030–2034 limits.

### Other major jurisdictions (comparison context)
- **Boston (BERDO 2.0):** five-year compliance periods running 2025–2050; $234/metric ton penalty into an Equitable Emissions Investment Fund; $1,000/day fines began 2025 for buildings over 35,000 sq ft; 2026 reporting deadline extended from May 15 to August 15.
- **Washington DC (BEPS):** compliance tied directly to ENERGY STAR score performance; maximum penalty exposure up to $10/sq ft (~$1M for a 100,000 sq ft building) in the 2026 compliance cycle.
- **Philadelphia:** annual benchmarking plus periodic audits/tune-ups since 2024; $300/day late-filing penalty.
- **Washington State:** first statewide BPS, tiered EUI targets by building size.
- Denver and Chicago also have active programs as of 2026.

### Portfolio-level compliance risk (NY asset manager view)
- LL97 caps and penalties apply **per building**, not per portfolio — a portfolio dashboard needs a per-asset exposure line rolling up to a total portfolio liability figure, not a single blended number.
- As caps tighten from 2030 onward, a growing share of buildings across a portfolio are expected to fall out of compliance, increasing exposure for owners who delay — arguing for a portfolio view sortable by dollar exposure, not just a compliance status flag per building.
- Annual aggregate benchmarking data alone may not be sufficient to avoid fines; monthly or more frequent data lets an owner catch a building drifting over its cap mid-year and course-correct before the annual filing — relevant to an anomaly/early-warning layer aggregated across the whole portfolio.
- LL97 exposure is increasingly treated as a standard ESG due-diligence item by institutional investors and is expected to influence cap-rate comparisons by 2027 — tying regulatory exposure directly to asset valuation, a portfolio-level (not single-building) concern.
- Mitigation levers worth modeling in aggregate across a portfolio: renewable energy credits, on-site solar, and prescriptive compliance paths — e.g., "how many buildings could close their compliance gap through centrally purchased RECs" vs. building-by-building capital projects.

---

## 6. Day-to-day manager workflow and internal reporting

### Single-building / property manager level
Findings here are directional (mostly vendor sources), not authoritative:
- Fragmented systems and manual, inconsistent processes are the most commonly cited pain point driving dashboard adoption; integrating building and energy/facilities systems enables continuous monitoring and more reliable reporting.
- One documented real-world policy specifies energy data tracked at least quarterly, with the property manager responsible for identifying usage trends and reporting them at the senior/leadership level against portfolio-wide reduction goals.
- "Dashboard review cadence" — how often leadership actually reviews the KPI dashboard — is itself tracked as an accountability metric in some frameworks.
- Effective programs fold sustainability tracking into routine maintenance workflows (e.g., logging waste diversion within maintenance checklists) rather than running it as a separate parallel process — relevant to how the dashboard should integrate with equipment/maintenance data, not just utility bills.
- Check-ins are frequently triggered by alert thresholds and compliance filing deadlines, not solely by a fixed calendar cadence.

### Portfolio level / asset manager reporting to LPs and investors
- Institutional LP reporting is layered by cadence: a quarterly baseline, deeper annual scrutiny, event-driven reporting on top, and real-time portal access at the edge.
- LPs evaluate both fund-level performance and per-property asset-level detail, expecting the same cadence and data consistency at both levels — asset-level detail is the layer most managers under-deliver, which is a direct opportunity for the dashboard's export function.
- Typical quarterly LP package structure: 15–25 pages for a fund with 5–10 assets, roughly one page per asset, a 1–2 page GP commentary letter, a 2–3 page financial summary, and variance analysis explaining budget-to-actual deviations at the asset level. This suggests each building needs a compact, standardized one-page ESG summary (coverage %, EUI, emissions vs. cap, certification status) that can be assembled into the portfolio package without manual reformatting.
- ILPA's standardized quarterly reporting template includes a dedicated ESG section covering the fund's approach, policies, incidents, and metrics at the asset level — explicitly because institutional LPs allocating across many fund relationships need comparable data across managers.
- Annual reporting is the second fixed cadence: best practice is a full annual ESG report using recognized frameworks (GRI/ESRS) for comparability, aligning with GRESB's own annual assessment cycle. This implies two export cadences from the dashboard: continuous/quarterly monitoring views, and a larger annual assembly for the formal ESG report and GRESB submission.
- Governance/event-driven reporting: material events are typically disclosed within a defined window (often 10–30 business days). For ESG this maps to events like a building crossing into non-compliance, a certification lapsing, or a significant drop in data coverage — arguing for event-triggered alerts distinct from the scheduled quarterly/annual cadence.
- Underlying driver: investor and lender requirements are cited as the primary driver of sustainability strategy at asset managers, just ahead of value creation — sustainability is increasingly treated as core risk management rather than a standalone initiative.

---

## Design implications

**Data model:** a single per-building record (source, confidence tier, freshness, Scope 1/2/3 breakdown, certification status/expiration) should serve as the atomic unit for every rollup — GRESB portfolio scores, LL97/BPS exposure totals, and LP report pages are all aggregations or exports of the same underlying data, not separate data-entry workflows.

**Three portfolio-level views, one shared data model:**
1. **GRESB-mapped view** — EN1/GH1/WT1/WS1/BC per asset, aggregated by GAV-weighted score, with a data-coverage overlay.
2. **Compliance-exposure view** — per-building dollar exposure under LL97 (and other applicable BPS laws), summed to a portfolio liability figure, sortable/filterable by risk.
3. **LP-reporting view** — one-page-per-asset summaries that assemble into the quarterly/annual investor package, plus an event-triggered alert feed for material ESG changes.

**Certification and Scope 3 categorization logic** should be lease-structure-aware, given the 2026 GRESB reclassification of landlord-controlled tenant emissions and the general lease-dependency of Scope 2/3 boundaries in NNN industrial portfolios.

---

## Sources

- GRESB: gresb.com/real-estate-assessment, gresb.com/insights/2026-standard-methodology-insights, guides.gresb.com (2026 Real Estate Assessment, GH1/EN1 indicator pages, Benchmark Report, Asset & Portfolio Classification), documents.gresb.com (Reference Guides 2022–2024)
- ENERGY STAR: energystar.gov/buildings/benchmark (score methodology, eligibility criteria, analyze results), portfoliomanager.energystar.gov
- LEED: usgbc.org/leed/rating-systems/existing-buildings, cagbc.org (LEED v5 O+M recertification), support.usgbc.org (maintaining certification, O+M certification approach), eeibuildingperformance.com, projectific.com
- GHG Protocol: noda.ai, tangoanalytics.com, workiva.com, climatepartner.com, planbe.eco
- NYC Local Law 97 and related laws: accelerator.nyc/ll97, dobguard.com, envigilance.com, zevero.earth, urbangreencouncil.org, ecometric.futuresenseai.com, insparisk.com
- Other BPS jurisdictions: vertenergygroup.com, oxmaint.com, facilitiesdive.com, doee.dc.gov (DC BEPS)
- Manager workflow and internal reporting: mrisoftware.com, yardi.com, columbia.reit (energy management policy), collateral.com (LP reporting expectations), yardiinvestmentsuite.com, pipelineroad.com (ILPA standards), investorreadycapital.com (quarterly LP reporting structure)

*Research compiled via web search, August 2026. Figures such as penalty rates and deadlines change; verify against primary sources (agency/city websites, GRESB Portal) before using in filings or investor materials.*
