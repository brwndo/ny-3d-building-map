# User Journey: "Can I trust this number, and can I defend it if audited?"

Four phases, tracking how trust in the data is built and then defended over time.

## Phase 1: First Look / Establishing Baseline Trust

**Goal**: know whether a number is real before doing anything with it.

- Data source per data point (utility API feed, submeter, tenant self-report, estimate)
- Confidence tier per metric (verified / estimated / missing), shown at the property level, not just portfolio-wide
- Data freshness / last-updated timestamp per property

## Phase 2: Ongoing Monitoring

**Goal**: catch and explain problems before they become surprises.

- Anomaly flags paired with an explanation (e.g., "meter swapped March 1," "tenant vacated") rather than a bare flag
- Data completeness trend over time — whether coverage is improving, flat, or degrading
- Explicit gap log — every missing data point and how it was handled (interpolated, prior-year carried forward, excluded)

## Phase 3: Audit Prep

**Goal**: build the defense before it's needed, not after.

- Source document retrieval per data point (utility bill, meter read, invoice — one click from any building/month)
- Methodology documentation (emissions factors used, grid region/year, unit conversions)
- Audit trail / change log — who touched a data point, when, and why
- Third-party verification status (e.g., direct utility API feed vs. manual entry, ENERGY STAR Portfolio Manager sync confirmation)

## Phase 4: The Audit

**Goal**: package trust for someone else to review.

- Exportable audit package per property or portfolio (number + source docs + methodology bundled together)
- Submission/filing confirmations (ENERGY STAR submission proof, LEED documentation status, benchmarking filing receipts)

## Design Implication

Trust is built incrementally in phases 1–2 (source → freshness → explained anomalies → completeness trend). Defensibility is a distinct, later need in phases 3–4 (documentation, audit trail, exportability) that most dashboards treat as out of scope because it isn't "monitoring." Building it into the same product means the officer never has to reconstruct a paper trail from scratch when a regulator or investor asks.
