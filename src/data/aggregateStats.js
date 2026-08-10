import { METRICS } from './colorScale';
import { isDerivedMetric, resolveAssetMetric } from './derivedMetrics';
import { fmtMetricValue, fmtMoney, fmtNumber, fmtPct } from './format';
import {
  compareToGoal,
  deadlineYearFromGoal,
  directionForMetric,
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
  portfolioRollupFor,
  shareMeetingThreshold,
  targetLabelFor,
} from './goalPrograms';

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

// Worst -> best, matching the legend order.
function formatBandCounts(counts) {
  return [...counts.entries()]
    .sort((a, b) => bandRank(a[0]) - bandRank(b[0]))
    .map(([band, count]) => `${count} ${band}`)
    .join(' · ');
}

const BAND_ORDER = ['Off Track', 'At Risk', 'On Track', 'Target Met'];

function bandRank(band) {
  const index = BAND_ORDER.indexOf(band);
  return index === -1 ? BAND_ORDER.length : index;
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

/**
 * How close the portfolio is to the whole program: the mean of the per-metric
 * progress already shown on the tiles below, so the headline and the numbers
 * backing it can never disagree.
 */
function programCompletionTile(program, metricStats, now) {
  const progresses = [];
  const expected = [];
  const deadlines = [];

  for (const stat of metricStats) {
    if (stat.goal?.p == null) continue;
    progresses.push(stat.goal.p);
    if (stat.goal.expectedP != null) expected.push(stat.goal.expectedP);
    if (stat.goal.deadline) deadlines.push(stat.goal.deadline);
  }

  const label = `${program.label} completion`;
  if (progresses.length === 0) {
    return emptyStat(label, 'No measurable targets in view');
  }

  const p = mean(progresses);
  const expectedP = expected.length > 0 ? mean(expected) : null;
  const pace = paceStatus(p, expectedP);

  return {
    label,
    value: fmtPct(p),
    hint:
      progresses.length === 1
        ? 'Portfolio progress toward the target'
        : `Mean progress across ${progresses.length} targets`,
    progress: {
      p,
      band: bandForProgress(p),
      pace,
      paceBand: paceBand(pace),
      caption: deadlineCaption(deadlines, now),
    },
    goal: null,
  };
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
  };
}

/**
 * The assets standing between the portfolio and this target. A null band means
 * the program does not score the asset on this metric at all, so it is not
 * holding anything back.
 */
export function blockerIdsFor(metricKey, visibleFeatures, metricBandFor) {
  const ids = [];
  for (const feature of visibleFeatures) {
    const band = metricBandFor(feature.properties, metricKey);
    if (band == null || band === 'Target Met') continue;
    ids.push(feature.properties.id);
  }
  return ids;
}

function metricTile(metricKey, visibleFeatures, { program, programGoals, metricBandFor, now }) {
  const tile = METRIC_TILES[metricKey];
  const rollup = portfolioRollupFor(program, metricKey);
  const rolled =
    rollup?.rollup === 'thresholdShare'
      ? thresholdShareRollup(metricKey, visibleFeatures, rollup)
      : defaultRollup(metricKey, visibleFeatures, tile, program);

  const stat = {
    label: rolled.label,
    value: fmtMetricValue(rolled.currentValue, rolled.unit),
    hint: [
      rolled.rollupHint,
      // The threshold hint already says how many assets clear the bar.
      rollup ? null : extraHintFor(metricKey, visibleFeatures),
      bandBreakdown(visibleFeatures, metricKey, metricBandFor),
    ]
      .filter(Boolean)
      .join(' · '),
    metricKey,
    blockerIds: blockerIdsFor(metricKey, visibleFeatures, metricBandFor),
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

function defaultRollup(metricKey, visibleFeatures, tile, program) {
  const getValue =
    tile.getValue ?? ((props) => resolveAssetMetric(props, metricKey)?.currentValue);
  const isSum = isSumMetric(metricKey);

  return {
    label: tile.label,
    currentValue: isSum
      ? sumBy(visibleFeatures, getValue)
      : floorAreaWeightedAverage(visibleFeatures, getValue),
    unit: metricUnit(visibleFeatures, metricKey) ?? tile.unitFallback,
    direction: directionForMetric(visibleFeatures, metricKey),
    rollupHint: isSum ? 'Portfolio total' : 'Floor-area weighted avg',
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
 * get a tile; portfolio size and LL97 exposure are always-on context.
 */
export function computeAggregateStats(visibleFeatures, options) {
  const { program, programGoals, metricBandFor, scoreFor, now = new Date() } = options;
  const count = visibleFeatures.length;
  const governed = governedMetricKeys(program).filter((key) => METRIC_TILES[key]);

  if (count === 0) {
    const stats = {
      portfolio: {
        label: 'Portfolio in view',
        value: fmtAssetCount(0),
        hint: 'Adjust filters to include assets',
        goal: null,
      },
    };
    stats.programCompletion = emptyStat(`${program.label} completion`);
    stats.targetsMet = emptyStat('Assets meeting all targets');
    for (const key of governed) {
      stats[key] = emptyStat(portfolioRollupFor(program, key)?.label ?? METRIC_TILES[key].label);
    }
    stats.compliance = emptyStat('LL97 exposure (2030)');
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
      now
    ),
    targetsMet: targetsMetTile(visibleFeatures, program, scoreFor),
  };

  for (const [key, stat] of metricStats) {
    stats[key] = stat;
  }

  stats.compliance = complianceTile(visibleFeatures);

  return stats;
}
