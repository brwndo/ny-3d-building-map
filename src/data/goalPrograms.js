// Goal programs answer "what is this target for?".
//
// A program is a named set of targets with a stated purpose and issuing
// authority. One program is active at a time; it drives the portfolio goal
// pack, the per-asset target shown in the drawer, and the band colors on the
// map. Only the metrics a program legitimately governs are exposed while it is
// active - LL97 says nothing about water use, so water is not offered.

import { METRICS, metricMeta, registerBandColors } from './colorScale';
import { DERIVED_PASS_VALUE, resolveAssetMetric } from './derivedMetrics';
import { aggregateValues, isSumMetric, yearEndDeadline } from './portfolioGoals';

export const PROGRAM_STORAGE_KEY = 'enertiv.goalProgram.v1';

const EPS = 1e-12;

/** How the map and legend encode an asset under the active program. */
export const MAP_SCALE_TYPES = {
  binary: 'binary',
  gateCount: 'gateCount',
  trajectory: 'trajectory',
  composite: 'composite',
};

// Mirrors BAND_THRESHOLDS in scripts/prepare_data.py so a client-computed band
// means the same thing as a precomputed one. Order: best -> worst.
const BAND_THRESHOLDS = [
  [1.0 - 1e-9, 'Target Met'],
  [0.75, 'On Track'],
  [0.4, 'At Risk'],
];

const PROGRESS_BANDS = [
  { key: 'Target Met', tone: 'best', meaning: 'at or past the target' },
  { key: 'On Track', tone: 'good', meaning: '75%+ of the way' },
  { key: 'At Risk', tone: 'warn', meaning: '40%+ of the way', atRisk: true },
  { key: 'Off Track', tone: 'worst', meaning: 'under 40% of the way', atRisk: true },
];

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function bandForProgress(p) {
  if (p == null) return null;
  for (const [threshold, label] of BAND_THRESHOLDS) {
    if (p >= threshold) return label;
  }
  return 'Off Track';
}

function binaryMapScale({ legendTitle, clearBand, failBand, clearMeaning, failMeaning }) {
  return {
    type: MAP_SCALE_TYPES.binary,
    legendTitle,
    bands: [
      { key: clearBand, tone: 'best', meaning: clearMeaning },
      { key: failBand, tone: 'worst', meaning: failMeaning, atRisk: true },
    ],
    clearBand,
    failBand,
    metricClearBand: clearBand,
    metricFailBand: failBand,
  };
}

function gateCountMapScale({ legendTitle }) {
  return {
    type: MAP_SCALE_TYPES.gateCount,
    legendTitle,
    bands: [
      { key: 'Ready', tone: 'best', meaning: 'all submission gates clear' },
      { key: 'Partial', tone: 'good', meaning: '3–4 gates clear' },
      { key: 'Behind', tone: 'warn', meaning: '1–2 gates clear', atRisk: true },
      { key: 'None', tone: 'worst', meaning: 'no gates clear', atRisk: true },
    ],
    clearBand: 'Ready',
    failBand: 'None',
    metricClearBand: 'Cleared',
    metricFailBand: 'Open',
  };
}

function progressMapScale({ type, legendTitle }) {
  return {
    type,
    legendTitle,
    bands: PROGRESS_BANDS,
    clearBand: 'Target Met',
    failBand: 'Off Track',
    metricClearBand: 'Target Met',
    metricFailBand: 'Off Track',
  };
}

function bandForGateCount(met, total) {
  if (total === 0) return null;
  if (met === total) return 'Ready';
  if (met === 0) return 'None';
  // With five GRESB gates: 3–4 → Partial, 1–2 → Behind.
  if (met / total >= 0.6) return 'Partial';
  return 'Behind';
}

const ALL_METRIC_KEYS = METRICS.map((m) => m.key);

/** Sum metrics can't use a portfolio total as a per-asset target; split it by
 *  floor-area share. Intensities and scores apply directly. */
function customTarget(metricKey) {
  return (props, ctx) => {
    const target = ctx.customGoals?.[metricKey]?.targetValue;
    if (target == null || !Number.isFinite(target)) return null;
    if (!isSumMetric(metricKey)) return target;
    if (!ctx.totalFloorArea || props.floorArea == null) return null;
    return target * (props.floorArea / ctx.totalFloorArea);
  };
}

function progressModelFor(key) {
  return metricMeta(key).type === 'fixed' ? 'ratio' : 'trajectory';
}

function customMetrics() {
  return Object.fromEntries(
    ['coverage', 'ghg', 'eui', 'water', 'energyStar'].map((key) => [
      key,
      {
        targetLabel: 'Custom target',
        progressModel: progressModelFor(key),
        assetTarget: customTarget(key),
        resolveDeadlineYear: (ctx) => yearOf(ctx.customGoals?.[key]?.deadline),
      },
    ])
  );
}

function yearOf(deadline) {
  if (!deadline) return null;
  const year = Number(String(deadline).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/** Invented building-type cohort water intensity (gal / sf / year). */
export const WATER_COHORT_GAL_PER_SF = {
  Manufacturing: 22,
  'Cold Storage': 14,
  'Flex Industrial': 12,
  'Light Industrial': 11,
  'Logistics/Cross-dock': 9,
  'Warehouse/Distribution': 8,
  'Mixed-Use Residential/Commercial': 16,
  Unknown: 12,
};

/** Beat the cohort baseline by this share (10%). */
export const WATER_COHORT_REDUCTION = 0.1;

export function waterCohortIntensity(propertyType) {
  return (
    WATER_COHORT_GAL_PER_SF[propertyType] ?? WATER_COHORT_GAL_PER_SF.Unknown
  );
}

/** Absolute gal target: cohort intensity × (1 − 10%) × floor area. */
export function waterCohortTarget(props) {
  if (props.floorArea == null || !Number.isFinite(props.floorArea)) return null;
  const intensity = waterCohortIntensity(props.propertyType);
  return intensity * (1 - WATER_COHORT_REDUCTION) * props.floorArea;
}

/**
 * A pass/fail requirement: the asset either satisfies it or it does not, and
 * the portfolio is graded on the share that do. Averaging a predicate would be
 * meaningless, so these always roll up as a threshold share.
 */
function readinessMetric({ assetRequirement, tileLabel, requiredShare }) {
  return {
    targetLabel: assetRequirement,
    progressModel: 'ratio',
    assetTarget: () => DERIVED_PASS_VALUE,
    portfolio: {
      rollup: 'thresholdShare',
      // Per asset the bar is simply "passes"; the share it has to reach is the
      // portfolio-level requirement.
      threshold: DERIVED_PASS_VALUE,
      target: requiredShare,
      unit: '%',
      label: tileLabel,
      // Prefixes the target value on the tile, e.g. "Submission bar 75.0% by 2026".
      targetLabel: 'Submission bar',
    },
  };
}

/** Portfolio headline score kinds for the Stats Panel (not map band logic). */
export const TOP_LEVEL_SCORE_TYPES = {
  compositeProgress: 'compositeProgress',
  singleTargetProgress: 'singleTargetProgress',
  complianceShare: 'complianceShare',
  readinessProgress: 'readinessProgress',
};

/** Overview chart under the headline KPI — matched to topLevelScore.type. */
export const OVERVIEW_CHART_TYPES = {
  trajectory: 'trajectory',
  complianceSplit: 'complianceSplit',
  readinessGates: 'readinessGates',
};

export const GOAL_PROGRAMS = [
  {
    id: 'll97_2030',
    label: 'LL97 Compliance (2030-2034)',
    purpose:
      'Stay under the NYC Local Law 97 emissions cap. Emissions over the cap cost $268 per mtCO2e.',
    // Headline under the program title: metric, threshold, and deadline in one line.
    goal: '100% of assets under the LL97 emissions cap by 2030',
    authority: 'NYC Local Law 97',
    editable: false,
    deadlineYear: 2029,
    // Assets under this coverage floor render grey — LL97 filings need defensible data.
    confidenceCoverage: 0.75,
    mapScale: binaryMapScale({
      legendTitle: 'LL97 2030–2034 cap status',
      clearBand: 'Under cap',
      failBand: 'Over cap',
      clearMeaning: 'emissions at or under the limit',
      failMeaning: 'emissions over the legal limit',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.complianceShare,
      overviewChart: OVERVIEW_CHART_TYPES.complianceSplit,
      label: 'Under LL97 cap',
      hint: 'Share of LL97-applicable assets under their 2030–2034 cap',
      splitLabels: { met: 'Under cap', unmet: 'Over cap' },
    },
    metrics: {
      ghg: {
        targetLabel: 'LL97 2030-2034 cap',
        tileLabel: 'Emissions vs LL97 cap',
        about:
          'Total Scope 1+2 emissions for LL97-applicable assets in view, compared with the sum of their 2030–2034 Local Law 97 caps. Assets not covered by LL97 are excluded. Emissions over the cap cost $268 per mtCO₂e.',
        progressModel: 'ratio',
        assetTarget: (props) => props.compliance?.limit2030 ?? null,
        applies: (props) => props.compliance?.ll97Applicable === 'Yes',
        exemptLabel: 'Not covered by LL97',
      },
    },
  },
  {
    id: 'energyStar75',
    label: 'Energy Star 75+ Coverage',
    purpose: 'Reach the 75+ score that gates ENERGY STAR certification eligibility.',
    goal: '100% of assets at ENERGY STAR score ≥ 75 by 2028',
    authority: 'EPA ENERGY STAR Portfolio Manager',
    editable: false,
    deadlineYear: 2028,
    confidenceCoverage: 0.65,
    mapScale: binaryMapScale({
      legendTitle: 'ENERGY STAR eligibility score',
      clearBand: 'Score ≥ 75',
      failBand: 'Below 75',
      clearMeaning: 'meets the certification score gate',
      failMeaning: 'below the certification score gate',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.complianceShare,
      overviewChart: OVERVIEW_CHART_TYPES.complianceSplit,
      label: 'Score ≥ 75',
      hint: 'Share of assets at or above the ENERGY STAR eligibility score',
      splitLabels: { met: 'Score ≥ 75', unmet: 'Below 75' },
    },
    metrics: {
      energyStar: {
        targetLabel: 'ENERGY STAR eligibility score',
        tileLabel: 'ENERGY STAR score',
        about:
          'Floor-area weighted average ENERGY STAR score for assets in view, with asset counts by score range. The eligibility gate is score ≥ 75.',
        progressModel: 'ratio',
        assetTarget: () => 75,
        tileChart: 'scoreRanges',
        scoreRanges: [
          { label: '90–100', min: 90, max: 100, tone: 'best' },
          { label: '75–89', min: 75, max: 89, tone: 'good' },
          { label: '50–74', min: 50, max: 74, tone: 'warn' },
          { label: '1–49', min: 1, max: 49, tone: 'worst' },
        ],
      },
    },
  },
  {
    id: 'gresbReady',
    label: 'GRESB Submission Readiness',
    purpose:
      'Clear every bar a credible annual GRESB submission depends on: coverage, twelve-month completeness, the four performance indicators, certifications, and verified data.',
    goal:
      'Clear all GRESB submission gates by 2026: 75% data coverage, 75% of assets with 12-month data, 95% with EN1+GH1+WT1+WS1, 50% certified, and 60% verified',
    authority: 'GRESB Real Estate Assessment',
    editable: false,
    deadlineYear: 2026,
    // Matches the GRESB coverage submission bar.
    confidenceCoverage: 0.75,
    mapScale: gateCountMapScale({
      legendTitle: 'Submission gates cleared (of 5)',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.readinessProgress,
      overviewChart: OVERVIEW_CHART_TYPES.readinessGates,
      label: 'Submission readiness',
      hint: 'Mean progress across GRESB submission bars',
    },
    metrics: {
      // Coverage is a measured percentage, so it grades on the floor-area
      // weighted portfolio average, as it always has.
      coverage: {
        targetLabel: 'GRESB coverage bar',
        tileLabel: 'Data coverage by total area',
        progressModel: 'ratio',
        assetTarget: () => 0.75,
      },
      // The rest are pass/fail per asset. An asset must pass outright, and the
      // portfolio is graded on how much of it does.
      completeness: readinessMetric({
        assetRequirement: 'Twelve months of whole-building data',
        tileLabel: 'Assets with 12-month data',
        requiredShare: 0.75,
      }),
      performanceData: readinessMetric({
        assetRequirement: 'EN1 + GH1 + WT1 + WS1 reported',
        tileLabel: 'Assets with full performance data',
        requiredShare: 0.95,
      }),
      certifications: readinessMetric({
        assetRequirement: 'Any BC credential on file',
        tileLabel: 'Assets with a certification',
        requiredShare: 0.5,
      }),
      confidence: readinessMetric({
        assetRequirement: 'Verified confidence tier',
        tileLabel: 'Assets with verified data',
        requiredShare: 0.6,
      }),
    },
  },
  {
    id: 'netZero2050',
    label: 'Net Zero 2050',
    purpose: 'Portfolio net-zero commitment: eliminate Scope 1+2 emissions by 2050.',
    goal: 'Reduce Scope 1+2 GHG emissions to net zero by 2050',
    authority: 'Portfolio commitment',
    editable: false,
    deadlineYear: 2050,
    confidenceCoverage: 0.65,
    mapScale: progressMapScale({
      type: MAP_SCALE_TYPES.trajectory,
      legendTitle: 'Trajectory to net zero (Scope 1+2)',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.singleTargetProgress,
      overviewChart: OVERVIEW_CHART_TYPES.trajectory,
      label: 'Trajectory to net zero',
      hint: 'Portfolio progress from baseline toward zero Scope 1+2',
    },
    metrics: {
      ghg: {
        targetLabel: 'Net zero Scope 1+2',
        tileLabel: 'Scope 1+2 to net zero',
        about:
          'Portfolio Scope 1+2 emissions for assets in view on the path from baseline to zero by 2050.',
        // Ratio to a zero target is undefined; measure travel from baseline.
        progressModel: 'trajectory',
        assetTarget: () => 0,
      },
    },
  },
  {
    id: 'waterCohort2028',
    label: 'Water vs Building Type Cohorts',
    purpose: 'Beat building-type cohort water intensity by 10%.',
    goal: '100% of assets ≤10% under their building-type cohort water use by 2028',
    authority: 'Portfolio water stewardship',
    editable: false,
    deadlineYear: 2028,
    confidenceCoverage: 0.65,
    mapScale: binaryMapScale({
      legendTitle: 'Water vs building-type cohort (−10%)',
      clearBand: 'Under cohort target',
      failBand: 'Over cohort target',
      clearMeaning: 'at or under 90% of cohort gal/sf × area',
      failMeaning: 'above 90% of cohort gal/sf × area',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.complianceShare,
      overviewChart: OVERVIEW_CHART_TYPES.complianceSplit,
      label: 'Under cohort target',
      hint: 'Share of assets at or under 90% of their building-type cohort water use',
      splitLabels: { met: 'Under cohort target', unmet: 'Over cohort target' },
    },
    metrics: {
      water: {
        targetLabel: 'Cohort −10% water use',
        tileLabel: 'Water use vs building-type cohort',
        about:
          'Each asset’s water use (gal) is compared with an invented building-type cohort intensity (gal/sf) × floor area, then reduced by 10%. Assets at or under that bar are Under cohort target; others are Over. Deadline is 2028.',
        progressModel: 'ratio',
        assetTarget: waterCohortTarget,
        applies: (props) =>
          props.floorArea != null && props.metrics?.water?.currentValue != null,
        exemptLabel: 'Missing water use or floor area',
      },
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    purpose: 'Targets you set for this portfolio.',
    goal: 'Hit your custom targets for ENERGY STAR, GHG, EUI, water, and data coverage',
    authority: 'Set in this dashboard',
    editable: true,
    confidenceCoverage: 0.65,
    mapScale: progressMapScale({
      type: MAP_SCALE_TYPES.composite,
      legendTitle: 'Progress across your custom targets',
    }),
    topLevelScore: {
      type: TOP_LEVEL_SCORE_TYPES.compositeProgress,
      overviewChart: OVERVIEW_CHART_TYPES.trajectory,
      label: 'Goal completion',
      hint: 'Mean progress across your custom targets',
    },
    metrics: customMetrics(),
  },
];

export const DEFAULT_PROGRAM_ID = 'll97_2030';

const PROGRAM_BY_ID = Object.fromEntries(GOAL_PROGRAMS.map((p) => [p.id, p]));

// Register every program band label (and gate metric chips) onto the palette.
for (const program of GOAL_PROGRAMS) {
  const scale = program.mapScale;
  if (!scale) continue;
  registerBandColors(scale.bands);
  if (scale.metricClearBand && scale.metricFailBand) {
    registerBandColors([
      { key: scale.metricClearBand, tone: 'best', meaning: 'clears this bar' },
      { key: scale.metricFailBand, tone: 'worst', meaning: 'short of this bar', atRisk: true },
    ]);
  }
}

export function getProgram(id) {
  return PROGRAM_BY_ID[id] ?? PROGRAM_BY_ID[DEFAULT_PROGRAM_ID];
}

/** Portfolio headline score config for the active program. */
export function topLevelScoreFor(program) {
  return (
    program?.topLevelScore ?? {
      type: TOP_LEVEL_SCORE_TYPES.compositeProgress,
      overviewChart: OVERVIEW_CHART_TYPES.trajectory,
      label: `${program?.label ?? 'Program'} completion`,
      hint: 'Mean progress across program targets',
    }
  );
}

/** Overview chart family for the Stats Panel headline section. */
export function overviewChartFor(program) {
  return topLevelScoreFor(program).overviewChart ?? OVERVIEW_CHART_TYPES.trajectory;
}

const DEFAULT_MAP_SCALE = progressMapScale({
  type: MAP_SCALE_TYPES.composite,
  legendTitle: 'Progress toward program targets',
});

/** Map / legend encoding for the active program. */
export function mapScaleFor(program) {
  return program?.mapScale ?? DEFAULT_MAP_SCALE;
}

/** Band labels in legend / filter / breakdown order (best → worst). */
export function mapBandKeys(program) {
  return mapScaleFor(program).bands.map((b) => b.key);
}

export function mapBandMeta(program, bandKey) {
  return mapScaleFor(program).bands.find((b) => b.key === bandKey) ?? null;
}

/** Whether this band counts as clearing the program bar (for blockers / filters). */
export function isClearedMetricBand(band, program) {
  if (band == null) return false;
  return band === mapScaleFor(program).metricClearBand;
}

/** Bands that AI / focus treat as needing attention. */
export function isAtRiskBand(band, program) {
  return Boolean(mapBandMeta(program, band)?.atRisk);
}

const DEFAULT_CONFIDENCE_COVERAGE = 0.65;

/** Coverage floor (0–1) that greys an asset under this program. */
export function confidenceCoverageFor(program) {
  const floor = program?.confidenceCoverage;
  return Number.isFinite(floor) ? floor : DEFAULT_CONFIDENCE_COVERAGE;
}

export function confidenceCoveragePct(program) {
  return Math.round(confidenceCoverageFor(program) * 100);
}

export function belowConfidenceThreshold(props, program) {
  const coverage = props?.dataCoverage;
  if (coverage == null) return true;
  return coverage < confidenceCoverageFor(program);
}

/** How many assets in view sit under the program coverage floor. */
export function confidenceBreakdown(features, program) {
  let below = 0;
  const total = features.length;
  for (const feature of features) {
    if (belowConfidenceThreshold(feature.properties, program)) below += 1;
  }
  const floor = confidenceCoverageFor(program);
  return {
    floor,
    floorPct: Math.round(floor * 100),
    below,
    clear: total - below,
    total,
  };
}

export function loadProgramId() {
  try {
    const stored = localStorage.getItem(PROGRAM_STORAGE_KEY);
    return stored && PROGRAM_BY_ID[stored] ? stored : DEFAULT_PROGRAM_ID;
  } catch {
    return DEFAULT_PROGRAM_ID;
  }
}

export function saveProgramId(id) {
  try {
    localStorage.setItem(PROGRAM_STORAGE_KEY, id);
  } catch {
    // Ignore quota / private-mode failures in the prototype.
  }
}

/** Governed metric keys, in the shared METRICS display order. */
export function governedMetricKeys(program) {
  return ALL_METRIC_KEYS.filter((key) => program.metrics[key]);
}

export function governsMetric(program, metricKey) {
  return Boolean(program.metrics[metricKey]);
}

/** How this program rolls the metric up to a portfolio number, if not the default. */
export function portfolioRollupFor(program, metricKey) {
  return program.metrics[metricKey]?.portfolio ?? null;
}

/** Coverage carries a top-level mirror of its metric value; prefer it. */
export function metricFieldValue(props, metricKey, field) {
  if (metricKey === 'coverage' && field === 'currentValue' && props.dataCoverage != null) {
    return props.dataCoverage;
  }
  return resolveAssetMetric(props, metricKey)?.[field] ?? null;
}

/**
 * Share of assets clearing a floor, for programs that grade the portfolio by
 * how many assets comply rather than by its average. Assumes higher is better,
 * which is what a floor means.
 */
export function shareMeetingThreshold(features, metricKey, threshold, field = 'currentValue') {
  let met = 0;
  let total = 0;

  for (const feature of features) {
    const value = metricFieldValue(feature.properties, metricKey, field);
    if (value == null) continue;
    total += 1;
    if (value >= threshold) met += 1;
  }

  return { share: total === 0 ? null : met / total, met, total };
}

export function targetLabelFor(program, metricKey) {
  return program.metrics[metricKey]?.targetLabel ?? 'Target';
}

/** Stats-tile title for a governed metric; falls back to the shared metric name. */
export function tileLabelFor(program, metricKey, fallback) {
  return program.metrics[metricKey]?.tileLabel ?? fallback;
}

/** Longer explanation for the metric info tip under the active program. */
export function metricAboutFor(program, metricKey) {
  return program.metrics[metricKey]?.about ?? null;
}

export function deadlineYearFor(program, metricKey, ctx) {
  const cfg = program.metrics[metricKey];
  if (!cfg) return null;
  if (cfg.resolveDeadlineYear && ctx) {
    const resolved = cfg.resolveDeadlineYear(ctx);
    if (resolved != null) return resolved;
  }
  return cfg.deadlineYear ?? program.deadlineYear ?? null;
}

/** Shared per-render inputs the target resolvers need. */
export function createProgramContext(features, customGoals) {
  let totalFloorArea = 0;
  for (const feature of features) {
    if (feature.properties.floorArea != null) totalFloorArea += feature.properties.floorArea;
  }
  return { totalFloorArea, customGoals };
}

export function appliesToAsset(program, metricKey, props) {
  const cfg = program.metrics[metricKey];
  if (!cfg) return false;
  return cfg.applies ? cfg.applies(props) : true;
}

export function assetTargetFor(props, metricKey, program, ctx) {
  const cfg = program.metrics[metricKey];
  if (!cfg || !appliesToAsset(program, metricKey, props)) return null;
  const target = cfg.assetTarget(props, ctx ?? { totalFloorArea: 0, customGoals: null });
  return Number.isFinite(target) ? target : null;
}

/** Direction-aware 0-1 progress for one asset under the active program. */
export function progressForAsset(props, metricKey, program, ctx) {
  const cfg = program.metrics[metricKey];
  if (!cfg || !appliesToAsset(program, metricKey, props)) return null;

  const metric = resolveAssetMetric(props, metricKey);
  const current = metric?.currentValue;
  const target = assetTargetFor(props, metricKey, program, ctx);
  if (current == null || target == null) return null;

  const lowerIsBetter = metric.direction === 'Lower is better';

  if (cfg.progressModel === 'trajectory') {
    const baseline = metric.baselineValue;
    if (baseline == null) return null;
    const span = lowerIsBetter ? baseline - target : target - baseline;
    if (Math.abs(span) < EPS) {
      return (lowerIsBetter ? current <= target : current >= target) ? 1 : 0;
    }
    const raw = lowerIsBetter ? (baseline - current) / span : (current - baseline) / span;
    return clamp01(raw);
  }

  if (lowerIsBetter) {
    return Math.abs(current) < EPS ? 1 : clamp01(target / current);
  }
  return Math.abs(target) < EPS ? 1 : clamp01(current / target);
}

/** Band label for one asset on one metric, or null when the program skips it. */
export function bandForAsset(props, metricKey, program, ctx) {
  if (!governsMetric(program, metricKey)) return null;
  if (program.usePrecomputedBands) return props.metrics?.[metricKey]?.band ?? null;

  const p = progressForAsset(props, metricKey, program, ctx);
  if (p == null) return null;

  const scale = mapScaleFor(program);
  if (
    scale.type === MAP_SCALE_TYPES.binary ||
    scale.type === MAP_SCALE_TYPES.gateCount
  ) {
    return meetsTarget(p) ? scale.metricClearBand : scale.metricFailBand;
  }
  return bandForProgress(p);
}

/** Programs with usePrecomputedBands read sheet progress; others derive it. */
function metricProgress(props, metricKey, program, ctx) {
  if (program.usePrecomputedBands) return props.metrics?.[metricKey]?.p ?? null;
  return progressForAsset(props, metricKey, program, ctx);
}

export function meetsTarget(p) {
  return p != null && p >= 1 - 1e-9;
}

function bandForScore(metrics, progress, program) {
  const scale = mapScaleFor(program);
  const met = metrics.filter((m) => m.met).length;
  const total = metrics.length;

  if (scale.type === MAP_SCALE_TYPES.binary) {
    return met === total ? scale.clearBand : scale.failBand;
  }
  if (scale.type === MAP_SCALE_TYPES.gateCount) {
    return bandForGateCount(met, total);
  }
  return bandForProgress(progress);
}

/**
 * How an asset stands against everything the program asks of it. Band labels
 * follow the program mapScale (binary, gate count, or % progress).
 */
export function scoreAsset(props, program, ctx) {
  const metrics = [];
  let progressSum = 0;

  for (const metricKey of governedMetricKeys(program)) {
    if (!appliesToAsset(program, metricKey, props)) continue;
    const p = metricProgress(props, metricKey, program, ctx);
    if (p == null) continue;
    metrics.push({ key: metricKey, p, met: meetsTarget(p) });
    progressSum += p;
  }

  if (metrics.length === 0) {
    return { band: null, met: 0, total: 0, progress: null, metrics: [], covered: false };
  }

  const progress = progressSum / metrics.length;
  const met = metrics.filter((m) => m.met).length;

  return {
    band: bandForScore(metrics, progress, program),
    met,
    total: metrics.length,
    progress,
    metrics,
    covered: true,
  };
}

/** Assets the program scores on nothing at all, e.g. LL97-exempt under LL97. */
export function uncoveredAssetCount(features, program, ctx) {
  return features.filter((f) => !scoreAsset(f.properties, program, ctx).covered).length;
}

/** Primary sentence the map color stands for. */
export function formatCompletion(score, program) {
  if (!score?.covered) return 'Not covered by this program';
  const scale = mapScaleFor(program);

  if (scale.type === MAP_SCALE_TYPES.binary) {
    return score.band ?? 'Not covered by this program';
  }
  if (scale.type === MAP_SCALE_TYPES.gateCount) {
    return `${score.met} of ${score.total} gates`;
  }
  if (score.progress == null) return 'Not covered by this program';
  const pct = `${Math.round(score.progress * 100)}%`;
  return score.total === 1 ? `${pct} to target` : `${pct} to all ${score.total} targets`;
}

/** Supporting detail beneath the completion figure. */
export function formatTargetsMet(score, program) {
  if (!score?.covered) return 'Not covered by this program';
  const scale = mapScaleFor(program);

  if (scale.type === MAP_SCALE_TYPES.binary) {
    const meta = mapBandMeta(program, score.band);
    return meta?.meaning ?? score.band;
  }
  if (scale.type === MAP_SCALE_TYPES.gateCount) {
    const meta = mapBandMeta(program, score.band);
    return meta ? `${score.band} — ${meta.meaning}` : score.band;
  }
  return `Meets ${score.met} of ${score.total} ${score.total === 1 ? 'target' : 'targets'}`;
}

/**
 * Everything a UI surface needs to show one asset's target and say what it is
 * for. Metrics the program does not govern fall back to the Baseline & Targets
 * sheet value, labeled as such, so no number is ever shown without a stated purpose.
 */
export function describeAssetMetric(props, metricKey, program, ctx) {
  const metric = resolveAssetMetric(props, metricKey);
  const governed = governsMetric(program, metricKey);

  if (!governed) {
    return {
      governed: false,
      covered: true,
      targetLabel: 'Baseline & Targets',
      targetValue: metric?.targetValue ?? null,
      targetYear: metric?.targetYear ?? null,
      band: metric?.band ?? null,
      p: metric?.p ?? null,
      unit: metric?.unit ?? null,
      currentValue: metric?.currentValue ?? null,
    };
  }

  const covered = appliesToAsset(program, metricKey, props);
  const band = bandForAsset(props, metricKey, program, ctx);

  return {
    governed: true,
    covered,
    targetLabel: covered ? targetLabelFor(program, metricKey) : exemptLabelFor(program, metricKey),
    targetValue: assetTargetFor(props, metricKey, program, ctx),
    targetYear: deadlineYearFor(program, metricKey, ctx) ?? metric?.targetYear ?? null,
    band,
    p: program.usePrecomputedBands
      ? (metric?.p ?? null)
      : progressForAsset(props, metricKey, program, ctx),
    unit: metric?.unit ?? null,
    currentValue: metric?.currentValue ?? null,
  };
}

export function exemptLabelFor(program, metricKey) {
  return program.metrics[metricKey]?.exemptLabel ?? 'Not covered by this program';
}

/**
 * Portfolio goal pack for the active program: aggregate the per-asset targets
 * the program implies, using the same sum vs floor-area-weighted rule as the
 * stats tiles so goal and current are directly comparable.
 */
export function resolveProgramGoals(features, program, ctx) {
  const goals = {};

  for (const metricKey of governedMetricKeys(program)) {
    const covered = features.filter((f) => appliesToAsset(program, metricKey, f.properties));
    if (covered.length === 0) {
      goals[metricKey] = null;
      continue;
    }

    const rollup = portfolioRollupFor(program, metricKey);

    // A compliance-share program measures "how many assets clear the floor", so
    // both target and baseline are shares of the asset count, not metric values.
    const targetValue =
      rollup?.rollup === 'thresholdShare'
        ? (rollup.target ?? 1)
        : aggregateValues(covered, metricKey, (props) =>
            assetTargetFor(props, metricKey, program, ctx)
          );
    // A derived predicate has no baseline row to share-count, so its starting
    // point is zero assets passing - which is also what progress should measure
    // from. Without the fallback compareToGoal returns null and the tile loses
    // its bar.
    const baselineValue =
      rollup?.rollup === 'thresholdShare'
        ? (shareMeetingThreshold(covered, metricKey, rollup.threshold, 'baselineValue').share ?? 0)
        : aggregateValues(covered, metricKey, (props) =>
            metricFieldValue(props, metricKey, 'baselineValue')
          );
    const baselineYear = modalMetricYear(covered, metricKey, 'baselineYear');
    const deadlineYear =
      deadlineYearFor(program, metricKey, ctx) ??
      modalMetricYear(covered, metricKey, 'targetYear');

    goals[metricKey] = {
      targetValue,
      baselineValue,
      baselineYear,
      deadline: yearEndDeadline(deadlineYear),
      coveredCount: covered.length,
    };
  }

  return goals;
}

function modalMetricYear(features, metricKey, field) {
  const counts = new Map();
  for (const feature of features) {
    const year = feature.properties.metrics?.[metricKey]?.[field];
    if (year == null || !Number.isFinite(Number(year))) continue;
    const y = Number(year);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}
