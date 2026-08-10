// Some programs grade an asset on facts that never appear in the Baseline &
// Targets sheet: whether twelve months of data exist, whether any certification
// is on file. Those have no baseline and no trend - they are true right now or
// they are not. Deriving them on read as 0/1 predicates lets the goal engine
// score them with the same machinery it uses for a metered metric, instead of
// needing a parallel "readiness" scoring path.

const PASS = 1;
const FAIL = 0;

function predicate(value) {
  return value ? PASS : FAIL;
}

/** The four GRESB performance indicators a submission is graded on. */
function hasPerformanceData(props) {
  const raw = props.raw;
  if (!raw) return false;
  return (
    raw.en1Imported != null &&
    raw.scope1 != null &&
    raw.scope2Location != null &&
    raw.wt1 != null &&
    raw.ws1 != null
  );
}

function hasAnyCert(props) {
  return Boolean(props.cert?.bc11 || props.cert?.bc12 || props.cert?.bc2);
}

export const DERIVED_METRICS = [
  {
    key: 'completeness',
    label: '12-Month Data Completeness',
    type: 'fixed',
    unit: 'pass',
    direction: 'Higher is better',
    derive: (props) => predicate(props.twelveMonthDataComplete),
  },
  {
    key: 'performanceData',
    label: 'Performance Data (EN1/GH1/WT1/WS1)',
    type: 'fixed',
    unit: 'pass',
    direction: 'Higher is better',
    derive: (props) => predicate(hasPerformanceData(props)),
  },
  {
    key: 'certifications',
    label: 'Building Certifications',
    type: 'fixed',
    unit: 'pass',
    direction: 'Higher is better',
    derive: (props) => predicate(hasAnyCert(props)),
  },
  {
    key: 'confidence',
    label: 'Verified Confidence',
    type: 'fixed',
    unit: 'pass',
    direction: 'Higher is better',
    derive: (props) => predicate(props.confidenceTier === 'Verified'),
  },
];

const DERIVED_BY_KEY = Object.fromEntries(DERIVED_METRICS.map((m) => [m.key, m]));

export function derivedMetricMeta(metricKey) {
  return DERIVED_BY_KEY[metricKey] ?? null;
}

export function isDerivedMetric(metricKey) {
  return Boolean(DERIVED_BY_KEY[metricKey]);
}

/**
 * The metric record for one asset, whichever kind of metric it is. Sheet
 * metrics come straight off the feature; derived metrics are synthesized into
 * the same shape so every caller can read `currentValue` / `direction` / `unit`
 * without asking which kind it holds.
 */
export function resolveAssetMetric(props, metricKey) {
  const derived = DERIVED_BY_KEY[metricKey];
  if (!derived) return props.metrics?.[metricKey] ?? null;

  return {
    unit: derived.unit,
    direction: derived.direction,
    currentValue: derived.derive(props),
    // A predicate has nowhere to travel from, so it is scored as a ratio
    // against its target rather than as progress along a baseline.
    baselineValue: null,
    baselineYear: null,
    targetValue: PASS,
    targetYear: null,
    band: null,
    p: null,
  };
}

/** The value an asset must reach for a derived predicate to count as passing. */
export const DERIVED_PASS_VALUE = PASS;
