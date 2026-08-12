import { BAND_TONES, METRICS } from './colorScale';
import { isDerivedMetric, resolveAssetMetric } from './derivedMetrics';
import { fmtMetricValue, fmtMoney, fmtNumber, fmtPct } from './format';
import {
  compareToGoal,
  deadlineYearFromGoal,
  directionForMetric,
  expectedProgressByDate,
  formatDeadlineHint,
  formatGoalLine,
  isSumMetric,
  paceBand,
  paceStatus,
  unitForMetric,
} from './portfolioGoals';
import {
  bandForProgress,
  governedMetricKeys,
  isClearedMetricBand,
  mapBandKeys,
  mapScaleFor,
  metricAboutFor,
  OVERVIEW_CHART_TYPES,
  portfolioRollupFor,
  shareMeetingThreshold,
  targetLabelFor,
  tileLabelFor,
  TOP_LEVEL_SCORE_TYPES,
  topLevelScoreFor,
} from './goalPrograms';

/** How a metric tile visualizes progress toward its portfolio goal. */
export const METRIC_TILE_CHART_TYPES = {
  bullet: 'bullet',
  shareVsRequired: 'shareVsRequired',
  /** Pass/fail share: met/total headline + unit bar of assets clearing the gate. */
  assetCount: 'assetCount',
  scoreRanges: 'scoreRanges',
};

/** ENERGY STAR 1–100 score buckets — eligibility gate sits at 75. */
export const ENERGY_STAR_SCORE_RANGES = [
  { label: '90–100', min: 90, max: 100, tone: 'best' },
  { label: '75–89', min: 75, max: 89, tone: 'good' },
  { label: '50–74', min: 50, max: 74, tone: 'warn' },
  { label: '1–49', min: 1, max: 49, tone: 'worst' },
];

const COVERAGE_THRESHOLD_PCT = 65;

// Per-metric rollup labels and value getters. The sum vs floor-area-weighted
// rule itself lives in portfolioGoals so goals and currents always agree.
const METRIC_TILES = {
  coverage: {
    label: 'Data coverage',
    getValue: (props) => props.dataCoverage ?? props.metrics?.coverage?.currentValue,
  },
  ghg: { label: metricLabel('ghg') },
  eui: { label: 'EUI' },
  waste: { label: 'Waste diversion' },
  water: { label: 'Water use' },
  energyStar: { label: metricLabel('energyStar'), unitFallback: '1-100' },
  // Derived predicates always carry a thresholdShare rollup, which supplies its
  // own label; these entries exist so computeAggregateStats does not drop them.
  completeness: { label: 'Assets with 12-month data' },
  performanceData: { label: 'Assets with full performance data' },
  certifications: { label: 'Assets with a certification' },
  confidence: { label: 'Assets with verified data' },
};

function metricLabel(key) {
  return METRICS.find((entry) => entry.key === key)?.label ?? key;
}

function metricUnit(features, metricKey) {
  return unitForMetric(features, metricKey);
}

function sumBy(features, getValue) {
  return features.reduce((acc, feature) => {
    const value = getValue(feature.properties);
    return value == null ? acc : acc + value;
  }, 0);
}

function floorAreaWeightedAverage(features, getValue) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const feature of features) {
    const weight = feature.properties.floorArea;
    const value = getValue(feature.properties);
    if (weight == null || value == null) continue;
    weightedSum += value * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

function fmtSqFt(value) {
  if (value == null) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M sq ft`;
  return `${fmtNumber(value)} sq ft`;
}

function fmtAssetCount(count) {
  if (count === 0) return 'No assets';
  return count === 1 ? '1 asset' : `${count} assets`;
}

function bandBreakdown(features, metricKey, metricBandFor) {
  const counts = new Map();

  for (const feature of features) {
    const band = metricBandFor(feature.properties, metricKey);
    if (!band) continue;
    counts.set(band, (counts.get(band) ?? 0) + 1);
  }

  return formatBandCounts(counts);
}

// Worst -> best for classic progress bands; program mapScale may differ.
function formatBandCounts(counts) {
  return [...counts.entries()]
    .sort((a, b) => bandRank(a[0]) - bandRank(b[0]))
    .map(([band, count]) => `${count} ${band}`)
    .join(' · ');
}

const CLASSIC_BAND_ORDER = ['Off Track', 'At Risk', 'On Track', 'Target Met'];

function bandRank(band) {
  const index = CLASSIC_BAND_ORDER.indexOf(band);
  return index === -1 ? CLASSIC_BAND_ORDER.length : index;
}

function emptyStat(label, hint = 'No matching assets') {
  return { label, value: '—', hint, goal: null };
}

function extraHintFor(metricKey, visibleFeatures) {
  if (metricKey === 'coverage') {
    const below = visibleFeatures.filter(
      (feature) => (feature.properties.dataCoverage ?? 0) * 100 < COVERAGE_THRESHOLD_PCT
    ).length;
    return `${below} below ${COVERAGE_THRESHOLD_PCT}%`;
  }
  if (metricKey === 'energyStar') {
    const eligible = visibleFeatures.filter(
      (feature) => feature.properties.energyStarEligible
    ).length;
    return `${eligible} eligible`;
  }
  return null;
}

function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function collectMetricProgress(metricStats, programGoals) {
  const progresses = [];
  const expected = [];
  const deadlines = [];
  const baselineYears = [];

  for (const stat of metricStats) {
    if (stat.goal?.p == null) continue;
    progresses.push(stat.goal.p);
    if (stat.goal.expectedP != null) expected.push(stat.goal.expectedP);
    if (stat.goal.deadline) deadlines.push(stat.goal.deadline);
  }

  for (const goal of Object.values(programGoals ?? {})) {
    if (!goal) continue;
    if (goal.baselineYear != null) baselineYears.push(goal.baselineYear);
  }

  return { progresses, expected, deadlines, baselineYears };
}

function completionTimeline(deadlines, baselineYears, now) {
  const endYear =
    deadlines.length > 0
      ? Math.max(...deadlines.map((d) => deadlineYearFromGoal({ deadline: d })))
      : null;
  const startYear =
    baselineYears.length > 0
      ? Math.min(...baselineYears)
      : endYear != null
        ? endYear - 5
        : null;

  return {
    caption: deadlineCaption(deadlines, now),
    startYear,
    endYear,
  };
}

function meanProgressTile(program, metricStats, now, programGoals, { label, hint, scoreType, overviewChart, gates }) {
  const { progresses, expected, deadlines, baselineYears } = collectMetricProgress(
    metricStats,
    programGoals
  );

  if (progresses.length === 0) {
    return emptyStat(label, 'No measurable targets in view');
  }

  const p = mean(progresses);
  const expectedP = expected.length > 0 ? mean(expected) : null;
  const pace = paceStatus(p, expectedP);
  const timeline = completionTimeline(deadlines, baselineYears, now);

  const defaultHint =
    progresses.length === 1
      ? 'Portfolio progress toward the target'
      : `Mean progress across ${progresses.length} targets`;

  return {
    label,
    value: fmtPct(p),
    hint: hint ?? defaultHint,
    scoreType,
    overviewChart: overviewChart ?? OVERVIEW_CHART_TYPES.trajectory,
    gates: gates ?? null,
    split: null,
    progress: {
      p,
      expectedP,
      band: bandForProgress(p),
      pace,
      paceBand: paceBand(pace),
      ...timeline,
    },
    goal: null,
  };
}

/**
 * Share of covered assets clearing every program bar. The headline and bar both
 * show that share (target = 100% clearing). Pace still follows the deadline window.
 */
function complianceShareTile(program, visibleFeatures, scoreFor, now, programGoals, scoreCfg) {
  const label = scoreCfg.label;
  let meetingAll = 0;
  let covered = 0;

  for (const feature of visibleFeatures) {
    const score = scoreFor(feature.properties);
    if (!score.covered) continue;
    covered += 1;
    if (score.met === score.total) meetingAll += 1;
  }

  if (covered === 0) {
    return emptyStat(label, 'No assets covered by this program');
  }

  const share = meetingAll / covered;
  const primaryKey = governedMetricKeys(program)[0];
  const goal = primaryKey ? programGoals?.[primaryKey] : null;

  let deadlines = [];
  let baselineYears = [];
  let expectedP = null;

  if (goal?.deadline) {
    deadlines = [goal.deadline];
    if (goal.baselineYear != null) baselineYears = [goal.baselineYear];
    expectedP = expectedProgressByDate(
      {
        ...goal,
        targetValue: 1,
        baselineValue: goal.baselineValue != null ? goal.baselineValue : 0,
      },
      now
    );
  } else if (program.deadlineYear != null) {
    deadlines = [`${program.deadlineYear}-12-31`];
    expectedP = expectedProgressByDate(
      {
        deadline: deadlines[0],
        baselineYear: program.deadlineYear - 5,
        baselineValue: 0,
        targetValue: 1,
      },
      now
    );
  }

  const p = share;
  const pace = paceStatus(p, expectedP);
  const timeline = completionTimeline(deadlines, baselineYears, now);
  const unmet = covered - meetingAll;
  const splitLabels = scoreCfg.splitLabels ?? { met: 'Clearing bar', unmet: 'Short of bar' };

  return {
    label,
    value: fmtPct(share),
    hint: scoreCfg.hint ?? `${meetingAll} of ${covered} assets clear the bar`,
    scoreType: TOP_LEVEL_SCORE_TYPES.complianceShare,
    overviewChart: scoreCfg.overviewChart ?? OVERVIEW_CHART_TYPES.complianceSplit,
    gates: null,
    split: {
      met: meetingAll,
      unmet,
      covered,
      metLabel: splitLabels.met,
      unmetLabel: splitLabels.unmet,
      metShare: share,
      unmetShare: unmet / covered,
    },
    progress: {
      p,
      expectedP,
      band: bandForProgress(p),
      pace,
      paceBand: paceBand(pace),
      ...timeline,
    },
    goal: null,
    meetingAll,
    covered,
  };
}

/** One row per submission bar: current portfolio value vs required share/target. */
function readinessGatesFromMetricStats(metricStats) {
  return metricStats
    .filter((stat) => stat.currentValue != null && stat.goal?.targetValue != null)
    .map((stat) => {
      const current = Number(stat.currentValue);
      const target = Number(stat.goal.targetValue);
      const unit = stat.unit ?? '%';
      const fill = target === 0 ? (current <= 0 ? 1 : 0) : Math.min(1, Math.max(0, current / target));
      const isAssetCount =
        stat.tileChart === METRIC_TILE_CHART_TYPES.assetCount &&
        stat.met != null &&
        stat.total != null;
      return {
        key: stat.metricKey,
        label: stat.label,
        current,
        target,
        unit,
        fill,
        met: isAssetCount ? stat.met : null,
        total: isAssetCount ? stat.total : null,
        chart: isAssetCount
          ? METRIC_TILE_CHART_TYPES.assetCount
          : METRIC_TILE_CHART_TYPES.shareVsRequired,
        band: bandForProgress(stat.goal?.p ?? fill),
        metGate: fill >= 1 - 1e-9,
        p: stat.goal?.p ?? null,
      };
    });
}

/**
 * Portfolio headline for the active program. Type comes from the program's
 * topLevelScore config so compliance gates and trajectories are not forced
 * through a generic mean-completion label.
 */
function programCompletionTile(program, metricStats, now, programGoals, visibleFeatures, scoreFor) {
  const scoreCfg = topLevelScoreFor(program);
  const { type, label, hint, overviewChart } = scoreCfg;

  if (type === TOP_LEVEL_SCORE_TYPES.complianceShare) {
    return complianceShareTile(program, visibleFeatures, scoreFor, now, programGoals, scoreCfg);
  }

  const gates =
    overviewChart === OVERVIEW_CHART_TYPES.readinessGates ||
    type === TOP_LEVEL_SCORE_TYPES.readinessProgress
      ? readinessGatesFromMetricStats(metricStats)
      : null;

  return meanProgressTile(program, metricStats, now, programGoals, {
    label,
    hint,
    scoreType: type,
    overviewChart: overviewChart ?? OVERVIEW_CHART_TYPES.trajectory,
    gates,
  });
}

/** One deadline reads as a due date; several read as a window. */
function deadlineCaption(deadlines, now) {
  if (deadlines.length === 0) return null;
  const sorted = [...deadlines].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return formatDeadlineHint(first, now);
  return `Deadlines Dec ${deadlineYearFromGoal({ deadline: first })} to Dec ${deadlineYearFromGoal(
    { deadline: last }
  )}`;
}

/**
 * The strict companion to completion: how many assets clear every target the
 * active program sets.
 */
function targetsMetTile(visibleFeatures, program, scoreFor) {
  const counts = new Map();
  let meetingAll = 0;
  let covered = 0;

  for (const feature of visibleFeatures) {
    const score = scoreFor(feature.properties);
    if (!score.covered) continue;
    covered += 1;
    if (score.met === score.total) meetingAll += 1;
    counts.set(score.band, (counts.get(score.band) ?? 0) + 1);
  }

  const targetCount = governedMetricKeys(program).length;
  const noun = targetCount === 1 ? 'target' : 'targets';

  if (covered === 0) {
    return emptyStat('Assets meeting all targets', 'No assets covered by this program');
  }

  return {
    label: 'Assets meeting all targets',
    value: fmtPct(meetingAll / covered),
    hint: [
      `${meetingAll} of ${covered} meet all ${targetCount} ${noun}`,
      formatBandCounts(counts),
    ]
      .filter(Boolean)
      .join(' · '),
    goal: null,
    meetingAll,
    covered,
  };
}

/**
 * Program color-band mix for assets in view: share, count, and bar scale.
 * Always returns every band from the active mapScale so the breakdown stays
 * aligned with the legend.
 */
export function computeAssetBandBreakdown(visibleFeatures, scoreFor, program) {
  const order = mapBandKeys(program);
  const counts = Object.fromEntries(order.map((band) => [band, 0]));
  let covered = 0;

  for (const feature of visibleFeatures) {
    const score = scoreFor(feature.properties);
    if (!score?.covered || !score.band) continue;
    covered += 1;
    if (counts[score.band] != null) counts[score.band] += 1;
  }

  return {
    covered,
    title: mapScaleFor(program).legendTitle,
    rows: order.map((band) => {
      const count = counts[band];
      return {
        band,
        count,
        total: covered,
        pct: covered > 0 ? count / covered : 0,
        share: covered > 0 ? count / covered : 0,
      };
    }),
  };
}

/**
 * The assets standing between the portfolio and this target. A null band means
 * the program does not score the asset on this metric at all, so it is not
 * holding anything back.
 */
export function blockerIdsFor(metricKey, visibleFeatures, metricBandFor, program) {
  const ids = [];
  for (const feature of visibleFeatures) {
    const band = metricBandFor(feature.properties, metricKey);
    if (band == null || isClearedMetricBand(band, program)) continue;
    ids.push(feature.properties.id);
  }
  return ids;
}

function metricTile(metricKey, visibleFeatures, { program, programGoals, metricBandFor, now }) {
  const tile = METRIC_TILES[metricKey];
  const rollup = portfolioRollupFor(program, metricKey);
  const isThresholdShare = rollup?.rollup === 'thresholdShare';
  const rolled = isThresholdShare
    ? thresholdShareRollup(metricKey, visibleFeatures, rollup)
    : defaultRollup(metricKey, visibleFeatures, tile, program);

  const configuredChart = program.metrics[metricKey]?.tileChart;
  const tileChart =
    configuredChart ??
    (isThresholdShare
      ? METRIC_TILE_CHART_TYPES.assetCount
      : METRIC_TILE_CHART_TYPES.bullet);

  const scoreRanges =
    tileChart === METRIC_TILE_CHART_TYPES.scoreRanges
      ? scoreRangeBreakdown(
          visibleFeatures,
          metricKey,
          program.metrics[metricKey]?.scoreRanges ?? ENERGY_STAR_SCORE_RANGES
        )
      : null;

  const useAssetCount = tileChart === METRIC_TILE_CHART_TYPES.assetCount && rolled.total != null;

  const stat = {
    label: rolled.label,
    about: metricAboutFor(program, metricKey),
    value: useAssetCount
      ? `${rolled.met} / ${rolled.total}`
      : fmtMetricValue(rolled.currentValue, rolled.unit),
    currentValue: rolled.currentValue,
    met: rolled.met ?? null,
    total: rolled.total ?? null,
    direction: rolled.direction,
    unit: rolled.unit,
    tileChart,
    scoreRanges,
    hint: [
      rolled.rollupHint,
      // The threshold hint already says how many assets clear the bar.
      rollup ? null : extraHintFor(metricKey, visibleFeatures),
      bandBreakdown(visibleFeatures, metricKey, metricBandFor),
    ]
      .filter(Boolean)
      .join(' · '),
    metricKey,
    blockerIds: blockerIdsFor(metricKey, visibleFeatures, metricBandFor, program),
  };

  const goal = programGoals?.[metricKey];
  if (!goal || rolled.currentValue == null) return { ...stat, goal: null };

  const comparison = compareToGoal(rolled.currentValue, goal, rolled.direction, now);
  if (!comparison) return { ...stat, goal: null };

  return {
    ...stat,
    goal: {
      ...comparison,
      goalLine: formatGoalLine(goal, rolled.unit, rolled.targetLabel),
      unit: rolled.unit,
    },
  };
}

/**
 * Count assets into inclusive score buckets so the tile can show distribution,
 * not only a portfolio average.
 */
export function scoreRangeBreakdown(features, metricKey, ranges) {
  const rows = ranges.map((range) => ({
    label: range.label,
    min: range.min,
    max: range.max,
    tone: range.tone,
    count: 0,
    color: toneCss(range.tone),
  }));
  let total = 0;

  for (const feature of features) {
    const value =
      resolveAssetMetric(feature.properties, metricKey)?.currentValue ??
      (metricKey === 'energyStar' ? feature.properties.energyStarScore : null);
    if (value == null || !Number.isFinite(value)) continue;
    total += 1;
    const bucket = rows.find((row) => value >= row.min && value <= row.max);
    if (bucket) bucket.count += 1;
  }

  return {
    total,
    rows: rows.map((row) => ({
      label: row.label,
      count: row.count,
      total,
      pct: total > 0 ? row.count / total : 0,
      color: row.color,
    })),
  };
}

function toneCss(tone) {
  const entry = BAND_TONES[tone];
  if (!entry) return '#9ea3ac';
  return `rgb(${entry.color.join(',')})`;
}

function defaultRollup(metricKey, visibleFeatures, tile, program) {
  const getValue =
    tile.getValue ?? ((props) => resolveAssetMetric(props, metricKey)?.currentValue);
  const isSum = isSumMetric(metricKey);

  return {
    label: tileLabelFor(program, metricKey, tile.label),
    currentValue: isSum
      ? sumBy(visibleFeatures, getValue)
      : floorAreaWeightedAverage(visibleFeatures, getValue),
    unit: metricUnit(visibleFeatures, metricKey) ?? tile.unitFallback,
    direction: directionForMetric(visibleFeatures, metricKey),
    rollupHint: isSum ? 'Portfolio total of covered assets' : 'Floor-area weighted avg',
    targetLabel: targetLabelFor(program, metricKey),
  };
}

/** A floor reads better without a trailing zero: 75%, not 75.0%. */
function fmtThreshold(fraction) {
  return `${Number((fraction * 100).toFixed(1))}%`;
}

// Counts assets over a floor instead of averaging them, so a handful of
// well-covered towers can't hide the assets that are still short.
function thresholdShareRollup(metricKey, visibleFeatures, rollup) {
  const { share, met, total } = shareMeetingThreshold(
    visibleFeatures,
    metricKey,
    rollup.threshold
  );

  return {
    label: rollup.label,
    currentValue: share,
    unit: rollup.unit ?? '%',
    // A compliance share always improves upward, whatever the metric's direction.
    direction: 'Higher is better',
    met,
    total,
    // "at or above 100%" is a nonsense way to describe a pass/fail requirement.
    rollupHint: isDerivedMetric(metricKey)
      ? `${met} of ${total} passing`
      : `${met} of ${total} at or above ${fmtThreshold(rollup.threshold)}`,
    targetLabel: rollup.targetLabel,
  };
}

function complianceTile(visibleFeatures) {
  const ll97Features = visibleFeatures.filter(
    (feature) => feature.properties.compliance?.ll97Applicable === 'Yes'
  );
  const fine2030 =
    ll97Features.length > 0
      ? sumBy(ll97Features, (props) => Math.max(0, props.compliance?.fine2030 ?? 0))
      : null;
  const nonCompliant = ll97Features.filter(
    (feature) => feature.properties.compliance?.status2030 === 'Non-Compliant'
  ).length;
  const atRisk = ll97Features.filter(
    (feature) => feature.properties.compliance?.status2030 === 'At Risk'
  ).length;

  return {
    label: 'LL97 exposure (2030)',
    value: ll97Features.length > 0 ? fmtMoney(fine2030) : '$0',
    hint:
      ll97Features.length > 0
        ? `${nonCompliant} non-compliant · ${atRisk} at risk`
        : 'No LL97-applicable assets in view',
    goal: null,
  };
}

/**
 * Stats tiles for the assets in view. Only metrics the active program governs
 * get a tile. LL97 $ exposure is LL97-program context only — not always-on.
 */
export function computeAggregateStats(visibleFeatures, options) {
  const { program, programGoals, metricBandFor, scoreFor, now = new Date() } = options;
  const count = visibleFeatures.length;
  const governed = governedMetricKeys(program).filter((key) => METRIC_TILES[key]);
  const showLl97Exposure = program?.id === 'll97_2030';

  if (count === 0) {
    const stats = {
      portfolio: {
        label: 'Portfolio in view',
        value: fmtAssetCount(0),
        hint: 'Adjust filters to include assets',
        goal: null,
      },
    };
    stats.programCompletion = emptyStat(topLevelScoreFor(program).label);
    stats.targetsMet = emptyStat('Assets meeting all targets');
    for (const key of governed) {
      stats[key] = emptyStat(
        portfolioRollupFor(program, key)?.label ??
          tileLabelFor(program, key, METRIC_TILES[key].label)
      );
    }
    if (showLl97Exposure) {
      stats.compliance = emptyStat('LL97 exposure (2030)');
    }
    return stats;
  }

  const metricStats = governed.map((key) => [
    key,
    metricTile(key, visibleFeatures, { program, programGoals, metricBandFor, now }),
  ]);

  const stats = {
    portfolio: {
      label: 'Portfolio in view',
      value: fmtAssetCount(count),
      hint: fmtSqFt(sumBy(visibleFeatures, (props) => props.floorArea)),
      goal: null,
    },
    programCompletion: programCompletionTile(
      program,
      metricStats.map(([, stat]) => stat),
      now,
      programGoals,
      visibleFeatures,
      scoreFor
    ),
    targetsMet: targetsMetTile(visibleFeatures, program, scoreFor),
  };

  for (const [key, stat] of metricStats) {
    stats[key] = stat;
  }

  if (showLl97Exposure) {
    stats.compliance = complianceTile(visibleFeatures);
  }

  return stats;
}
