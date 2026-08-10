// Goal programs answer "what is this target for?".
//
// A program is a named set of targets with a stated purpose and issuing
// authority. One program is active at a time; it drives the portfolio goal
// pack, the per-asset target shown in the drawer, and the band colors on the
// map. Only the metrics a program legitimately governs are exposed while it is
// active - LL97 says nothing about water use, so water is not offered.

import { METRICS, SHEET_METRIC_KEYS, metricMeta } from './colorScale';
import { DERIVED_PASS_VALUE, resolveAssetMetric } from './derivedMetrics';
import { aggregateValues, isSumMetric, yearEndDeadline } from './portfolioGoals';

export const PROGRAM_STORAGE_KEY = 'enertiv.goalProgram.v1';

const EPS = 1e-12;

const COVERAGE_FLOOR = 0.75;

// Mirrors BAND_THRESHOLDS in scripts/prepare_data.py so a client-computed band
// means the same thing as a precomputed one. Order: best -> worst.
const BAND_THRESHOLDS = [
  [1.0 - 1e-9, 'Target Met'],
  [0.75, 'On Track'],
  [0.4, 'At Risk'],
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

const ALL_METRIC_KEYS = METRICS.map((m) => m.key);

function assetPlanTarget(metricKey) {
  return (props) => props.metrics?.[metricKey]?.targetValue ?? null;
}

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

// Only the sheet metrics: the asset plan commits to numbers that came from the
// Baseline & Targets sheet, and a derived predicate has no row there.
function assetPlanMetrics() {
  return Object.fromEntries(
    SHEET_METRIC_KEYS.map((key) => [
      key,
      {
        targetLabel: 'Asset plan target',
        progressModel: progressModelFor(key),
        assetTarget: assetPlanTarget(key),
      },
    ])
  );
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

export const GOAL_PROGRAMS = [
  {
    id: 'assetPlan',
    label: 'Asset Plan',
    purpose: 'Internal decarbonization plan committed in the asset budget.',
    authority: 'Baseline & Targets (asset plan)',
    editable: false,
    // Bands ship precomputed for this program, so the map matches the sheet exactly.
    usePrecomputedBands: true,
    metrics: assetPlanMetrics(),
  },
  {
    id: 'll97_2030',
    label: 'LL97 Compliance (2030-2034)',
    purpose:
      'Stay under the NYC Local Law 97 emissions cap. Emissions over the cap cost $268 per mtCO2e.',
    authority: 'NYC Local Law 97',
    editable: false,
    deadlineYear: 2029,
    metrics: {
      ghg: {
        targetLabel: 'LL97 2030-2034 cap',
        progressModel: 'ratio',
        assetTarget: (props) => props.compliance?.limit2030 ?? null,
        applies: (props) => props.compliance?.ll97Applicable === 'Yes',
        exemptLabel: 'Not covered by LL97',
      },
    },
  },
  {
    id: 'energyStar75',
    label: 'ENERGY STAR Certification',
    purpose: 'Reach the 75+ score that gates ENERGY STAR certification eligibility.',
    authority: 'EPA ENERGY STAR Portfolio Manager',
    editable: false,
    deadlineYear: 2028,
    metrics: {
      energyStar: {
        targetLabel: 'ENERGY STAR eligibility score',
        progressModel: 'ratio',
        assetTarget: () => 75,
      },
    },
  },
  {
    id: 'gresbReady',
    label: 'GRESB Submission Readiness',
    purpose:
      'Clear every bar a credible annual GRESB submission depends on: coverage, twelve-month completeness, the four performance indicators, certifications, and verified data.',
    authority: 'GRESB Real Estate Assessment',
    editable: false,
    deadlineYear: 2026,
    metrics: {
      // Coverage is a measured percentage, so it grades on the floor-area
      // weighted portfolio average, as it always has.
      coverage: {
        targetLabel: 'GRESB coverage bar',
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
    id: 'coverage75',
    label: 'Data Coverage 75%',
    purpose:
      'Bring every asset to at least 75% data coverage. Progress is the share of assets that clear the floor, not the portfolio average.',
    authority: 'Internal data governance',
    editable: false,
    deadlineYear: 2026,
    metrics: {
      coverage: {
        targetLabel: '75% coverage floor',
        progressModel: 'ratio',
        assetTarget: () => COVERAGE_FLOOR,
        // An average can clear 75% while a third of the portfolio sits below it,
        // so this program counts assets over the floor instead.
        portfolio: {
          rollup: 'thresholdShare',
          threshold: COVERAGE_FLOOR,
          target: 1,
          unit: '%',
          label: 'Assets meeting 75% coverage',
          targetLabel: 'Every asset over the floor',
        },
      },
    },
  },
  {
    id: 'netZero2050',
    label: 'Net Zero 2050',
    purpose: 'Portfolio net-zero commitment: eliminate Scope 1+2 emissions by 2050.',
    authority: 'Portfolio commitment',
    editable: false,
    deadlineYear: 2050,
    metrics: {
      ghg: {
        targetLabel: 'Net zero Scope 1+2',
        // Ratio to a zero target is undefined; measure travel from baseline.
        progressModel: 'trajectory',
        assetTarget: () => 0,
      },
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    purpose: 'Targets you set for this portfolio.',
    authority: 'Set in this dashboard',
    editable: true,
    metrics: customMetrics(),
  },
];

export const DEFAULT_PROGRAM_ID = 'assetPlan';

const PROGRAM_BY_ID = Object.fromEntries(GOAL_PROGRAMS.map((p) => [p.id, p]));

export function getProgram(id) {
  return PROGRAM_BY_ID[id] ?? PROGRAM_BY_ID[DEFAULT_PROGRAM_ID];
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
  return bandForProgress(progressForAsset(props, metricKey, program, ctx));
}

/** Asset Plan progress ships precomputed; every other program derives it. */
function metricProgress(props, metricKey, program, ctx) {
  if (program.usePrecomputedBands) return props.metrics?.[metricKey]?.p ?? null;
  return progressForAsset(props, metricKey, program, ctx);
}

export function meetsTarget(p) {
  return p != null && p >= 1 - 1e-9;
}

/**
 * How complete an asset is toward everything the program asks of it: the mean
 * progress across its targets. Because per-target progress is clamped to 0-1, a
 * completion of 1 is only reachable when every target is met, so "Target Met"
 * still means fully compliant.
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

  return {
    band: bandForProgress(progress),
    met: metrics.filter((m) => m.met).length,
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

/** "83% to all 6 targets" — the sentence the color band stands for. */
export function formatCompletion(score) {
  if (!score?.covered || score.progress == null) return 'Not covered by this program';
  const pct = `${Math.round(score.progress * 100)}%`;
  return score.total === 1 ? `${pct} to target` : `${pct} to all ${score.total} targets`;
}

/** Supporting detail beneath the completion figure, not what color encodes. */
export function formatTargetsMet(score) {
  if (!score?.covered) return 'Not covered by this program';
  return `Meets ${score.met} of ${score.total} ${score.total === 1 ? 'target' : 'targets'}`;
}

/**
 * Everything a UI surface needs to show one asset's target and say what it is
 * for. Metrics the program does not govern fall back to the asset plan target,
 * labeled as such, so no number is ever shown without a stated purpose.
 */
export function describeAssetMetric(props, metricKey, program, ctx) {
  const metric = resolveAssetMetric(props, metricKey);
  const governed = governsMetric(program, metricKey);

  if (!governed) {
    return {
      governed: false,
      covered: true,
      targetLabel: 'Asset plan target',
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
