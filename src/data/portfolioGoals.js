import { METRICS } from './colorScale';
import { fmtMetricValue } from './format';

export const STORAGE_KEY = 'enertiv.portfolioGoals.v1';

/** Metrics that participate in the portfolio Performance Goal pack. */
export const GOAL_METRIC_KEYS = ['coverage', 'ghg', 'eui', 'water', 'energyStar'];

const SUM_KEYS = new Set(['ghg', 'water']);

const PACE = {
  AHEAD: 'Ahead',
  ON_PACE: 'On Pace',
  BEHIND: 'Behind',
};

const PACE_BAND = {
  [PACE.AHEAD]: 'Target Met',
  [PACE.ON_PACE]: 'On Track',
  [PACE.BEHIND]: 'At Risk',
};

const PACE_TOLERANCE = 0.05;

export function isGoalMetric(key) {
  return GOAL_METRIC_KEYS.includes(key);
}

export function goalMetricMeta(key) {
  return METRICS.find((entry) => entry.key === key);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
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

function aggregateMetricField(features, metricKey, field) {
  const getValue = (props) => props.metrics?.[metricKey]?.[field];
  return SUM_KEYS.has(metricKey)
    ? sumBy(features, getValue)
    : floorAreaWeightedAverage(features, getValue);
}

function modalYear(features, metricKey, field) {
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

function yearEndDeadline(year) {
  if (year == null) return null;
  return `${Number(year)}-12-31`;
}

function deadlineYear(deadline) {
  if (!deadline) return null;
  const year = Number(String(deadline).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

export function directionForMetric(features, metricKey) {
  return (
    features[0]?.properties.metrics?.[metricKey]?.direction ??
    (SUM_KEYS.has(metricKey) || metricKey === 'eui'
      ? 'Lower is better'
      : 'Higher is better')
  );
}

export function unitForMetric(features, metricKey) {
  return features[0]?.properties.metrics?.[metricKey]?.unit ?? null;
}

/** Derive the default portfolio goal pack from asset-level targets. */
export function derivePortfolioGoals(features) {
  const goals = {};
  for (const key of GOAL_METRIC_KEYS) {
    const targetValue = aggregateMetricField(features, key, 'targetValue');
    const baselineValue = aggregateMetricField(features, key, 'baselineValue');
    const targetYear = modalYear(features, key, 'targetYear');
    const baselineYear = modalYear(features, key, 'baselineYear');
    goals[key] = {
      targetValue,
      baselineValue,
      baselineYear,
      deadline: yearEndDeadline(targetYear),
    };
  }
  return goals;
}

function isValidGoal(goal) {
  return (
    goal &&
    typeof goal === 'object' &&
    Number.isFinite(goal.targetValue) &&
    Number.isFinite(goal.baselineValue) &&
    typeof goal.deadline === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(goal.deadline)
  );
}

export function loadPortfolioGoals(features) {
  const defaults = derivePortfolioGoals(features);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const stored = JSON.parse(raw);
    if (!stored || typeof stored !== 'object') return defaults;
    const merged = { ...defaults };
    for (const key of GOAL_METRIC_KEYS) {
      if (isValidGoal(stored[key])) {
        merged[key] = {
          ...defaults[key],
          targetValue: stored[key].targetValue,
          deadline: stored[key].deadline,
          // Keep editable baseline if stored; else derived.
          baselineValue: Number.isFinite(stored[key].baselineValue)
            ? stored[key].baselineValue
            : defaults[key].baselineValue,
          baselineYear: Number.isFinite(stored[key].baselineYear)
            ? stored[key].baselineYear
            : defaults[key].baselineYear,
        };
      }
    }
    return merged;
  } catch {
    return defaults;
  }
}

export function savePortfolioGoals(goals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
  } catch {
    // Ignore quota / private-mode failures in the prototype.
  }
}

export function patchPortfolioGoal(goals, metricKey, patch) {
  if (!isGoalMetric(metricKey)) return goals;
  const current = goals[metricKey];
  if (!current) return goals;

  const next = { ...current };
  if (patch.targetValue != null && Number.isFinite(Number(patch.targetValue))) {
    next.targetValue = Number(patch.targetValue);
  }
  if (patch.baselineValue != null && Number.isFinite(Number(patch.baselineValue))) {
    next.baselineValue = Number(patch.baselineValue);
  }
  if (patch.baselineYear != null && Number.isFinite(Number(patch.baselineYear))) {
    next.baselineYear = Number(patch.baselineYear);
  }
  if (patch.deadlineYear != null && Number.isFinite(Number(patch.deadlineYear))) {
    next.deadline = yearEndDeadline(Number(patch.deadlineYear));
  } else if (typeof patch.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(patch.deadline)) {
    next.deadline = patch.deadline;
  }

  return { ...goals, [metricKey]: next };
}

/**
 * Direction-aware progress from baseline → target given a portfolio current.
 * Returns clamped p for bars plus raw progress (may be outside 0–1).
 */
export function progressTowardGoal(currentValue, goal, direction) {
  if (
    currentValue == null ||
    !goal ||
    goal.targetValue == null ||
    goal.baselineValue == null
  ) {
    return { p: null, raw: null };
  }

  const { baselineValue: baseline, targetValue: target } = goal;
  const lowerIsBetter = direction === 'Lower is better';
  const span = lowerIsBetter ? baseline - target : target - baseline;

  let raw;
  if (Math.abs(span) < 1e-9) {
    raw = lowerIsBetter
      ? currentValue <= target
        ? 1
        : 0
      : currentValue >= target
        ? 1
        : 0;
  } else if (lowerIsBetter) {
    raw = (baseline - currentValue) / span;
  } else {
    raw = (currentValue - baseline) / span;
  }

  return { p: clamp01(raw), raw };
}

function baselineDate(goal) {
  const year = goal.baselineYear ?? deadlineYear(goal.deadline) - 5;
  if (!Number.isFinite(year)) return null;
  return new Date(year, 0, 1);
}

export function expectedProgressByDate(goal, now = new Date()) {
  if (!goal?.deadline) return null;
  const start = baselineDate(goal);
  const end = new Date(`${goal.deadline}T23:59:59`);
  if (!start || Number.isNaN(end.getTime())) return null;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return currentValueAtOrPastDeadline(now, end) ? 1 : 0;
  return clamp01((now.getTime() - start.getTime()) / total);
}

function currentValueAtOrPastDeadline(now, end) {
  return now.getTime() >= end.getTime();
}

export function paceStatus(p, expectedP) {
  if (p == null || expectedP == null) return null;
  const delta = p - expectedP;
  if (delta >= PACE_TOLERANCE) return PACE.AHEAD;
  if (delta <= -PACE_TOLERANCE) return PACE.BEHIND;
  return PACE.ON_PACE;
}

export function paceBand(pace) {
  return PACE_BAND[pace] ?? null;
}

export function formatDeadlineHint(deadline, now = new Date()) {
  const year = deadlineYear(deadline);
  if (year == null) return null;
  const end = new Date(`${deadline}T23:59:59`);
  const msLeft = end.getTime() - now.getTime();
  if (msLeft < 0) {
    const yearsOver = Math.max(1, Math.ceil(Math.abs(msLeft) / (365.25 * 24 * 3600 * 1000)));
    return `Due Dec ${year} · ${yearsOver}y overdue`;
  }
  const yearsLeft = msLeft / (365.25 * 24 * 3600 * 1000);
  if (yearsLeft < 1) {
    const monthsLeft = Math.max(1, Math.round(msLeft / (30.44 * 24 * 3600 * 1000)));
    return `Due Dec ${year} · ${monthsLeft}mo left`;
  }
  return `Due Dec ${year} · ${Math.round(yearsLeft)}y left`;
}

export function formatGoalLine(goal, unit) {
  if (!goal || goal.targetValue == null) return null;
  const year = deadlineYear(goal.deadline);
  const target = fmtMetricValue(goal.targetValue, unit);
  return year != null ? `Goal ${target} · ${year}` : `Goal ${target}`;
}

/** Full comparison payload for a stats tile. */
export function compareToGoal(currentValue, goal, direction, now = new Date()) {
  if (!goal || currentValue == null) return null;
  const { p, raw } = progressTowardGoal(currentValue, goal, direction);
  const expectedP = expectedProgressByDate(goal, now);
  const pace = paceStatus(p, expectedP);
  return {
    targetValue: goal.targetValue,
    deadline: goal.deadline,
    baselineValue: goal.baselineValue,
    baselineYear: goal.baselineYear,
    p,
    raw,
    expectedP,
    pace,
    paceBand: paceBand(pace),
    goalLine: null, // filled by caller with unit
    deadlineHint: formatDeadlineHint(goal.deadline, now),
  };
}

export function deadlineYearFromGoal(goal) {
  return deadlineYear(goal?.deadline);
}

export { PACE };
