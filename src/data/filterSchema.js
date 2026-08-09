// Declarative filter field definitions. Every field obeys the same rule:
// an empty/unset selection means the field is off, multiple values within one
// field OR together, and different fields AND together. Fields are split by
// effect - HIDE_FIELDS remove buildings from the map, GREY_FIELDS only
// override their color.

import { BANDS } from './colorScale';

// Sentinel for "this building has no value for this field" (certifications use
// the literal string 'None' in the sheet, normalized to null at prep time).
export const NONE = '__none__';
export const NONE_LABEL = 'None';

const BAND_ORDER = [...BANDS].map((b) => b.key).reverse();
const TIER_ORDER = ['Verified', 'Estimated', 'Missing'];

export const HIDE_FIELDS = [
  {
    key: 'band',
    group: 'performance',
    kind: 'multi',
    label: 'Show only bands',
    // Fixed rather than dataset-derived: the band set must not shift when the
    // selected metric changes out from under an active selection.
    options: BAND_ORDER,
    get: (p, ctx) => p.metrics?.[ctx.metricKey]?.band,
  },
  {
    key: 'city',
    group: 'property',
    kind: 'multi',
    label: 'City',
    get: (p) => p.city,
  },
  {
    key: 'propertyType',
    group: 'property',
    kind: 'multi',
    label: 'Property type',
    get: (p) => p.propertyType,
  },
  {
    key: 'floorArea',
    group: 'property',
    kind: 'range',
    label: 'Floor area',
    unit: 'sq ft',
    step: 1000,
    get: (p) => p.floorArea,
  },
  {
    key: 'bc11',
    group: 'cert',
    kind: 'multi',
    label: 'BC1.1 – Design/Construction',
    allowNone: true,
    get: (p) => p.cert?.bc11,
  },
  {
    key: 'bc12',
    group: 'cert',
    kind: 'multi',
    label: 'BC1.2 – Operational',
    allowNone: true,
    get: (p) => p.cert?.bc12,
  },
  {
    key: 'bc2',
    group: 'cert',
    kind: 'multi',
    label: 'BC2 – Ongoing',
    allowNone: true,
    get: (p) => p.cert?.bc2,
  },
];

export const GREY_FIELDS = [
  {
    key: 'coverage',
    kind: 'threshold',
    label: 'Data coverage at least',
    unit: '%',
    // Coverage is the one criterion that defaults on, per spec.
    default: { enabled: true, value: 65 },
    get: (p) => p.dataCoverage * 100,
  },
  {
    key: 'confidenceTier',
    kind: 'multi',
    label: 'Confidence tier',
    order: TIER_ORDER,
    get: (p) => p.confidenceTier,
  },
  {
    key: 'dataSource',
    kind: 'multi',
    label: 'Data source',
    get: (p) => p.dataSource,
  },
  {
    key: 'lastUpdated',
    kind: 'recency',
    label: 'Last updated',
    get: (p) => p.lastUpdated,
  },
];

export const FRESHNESS_OPTIONS = [
  { value: null, label: 'Any' },
  { value: 1, label: 'Within 1 month' },
  { value: 6, label: 'Within 6 months' },
  { value: 12, label: 'Within 1 year' },
];

const EMPTY_DEFAULT = {
  multi: () => [],
  range: () => null, // resolved against dataset bounds at read time
  threshold: (f) => ({ ...(f.default ?? { enabled: false, value: 0 }) }),
  recency: () => null,
};

export function defaultsFor(fields) {
  return Object.fromEntries(fields.map((f) => [f.key, EMPTY_DEFAULT[f.kind](f)]));
}

// A field that would admit every building contributes nothing and should not
// count toward "filters are active" - including a range dragged back out to
// the full dataset bounds.
export function isFieldActive(field, value, meta) {
  switch (field.kind) {
    case 'multi':
      return value.length > 0;
    case 'range':
      return value != null && (value[0] > meta.min || value[1] < meta.max);
    case 'threshold':
      return value.enabled;
    case 'recency':
      return value != null;
    default:
      return false;
  }
}

export function activeFieldCount(fields, state, meta) {
  return fields.filter((f) => isFieldActive(f, state[f.key], meta[f.key])).length;
}

function sortByOrder(values, order) {
  if (!order) return [...values].sort();
  const rank = (v) => {
    const i = order.indexOf(v);
    return i === -1 ? order.length : i;
  };
  return [...values].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}

// Option lists and range bounds come from the loaded dataset, never hardcoded.
export function deriveFieldMeta(fields, features, ctx) {
  const meta = {};
  for (const field of fields) {
    if (field.kind === 'multi' && field.options) {
      meta[field.key] = { options: field.options.map((v) => ({ value: v, label: v })) };
    } else if (field.kind === 'multi') {
      const present = new Set();
      let hasNone = false;
      for (const f of features) {
        const v = field.get(f.properties, ctx);
        if (v == null) hasNone = true;
        else present.add(v);
      }
      const options = sortByOrder([...present], field.order).map((v) => ({
        value: v,
        label: v,
      }));
      if (field.allowNone && hasNone) options.push({ value: NONE, label: NONE_LABEL });
      meta[field.key] = { options };
    } else if (field.kind === 'range') {
      const values = features.map((f) => field.get(f.properties, ctx));
      meta[field.key] = { min: Math.min(...values), max: Math.max(...values) };
    } else {
      meta[field.key] = {};
    }
  }
  return meta;
}

// Fills in defaults that depend on the dataset (range bounds) so matchers can
// stay ignorant of where the bounds came from.
export function resolveState(fields, state, meta) {
  const resolved = { ...state };
  for (const field of fields) {
    if (field.kind === 'range' && resolved[field.key] == null) {
      resolved[field.key] = [meta[field.key].min, meta[field.key].max];
    }
  }
  return resolved;
}
