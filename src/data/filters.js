// Filter evaluation. The AND/OR rule lives here and nowhere else: a matcher
// decides whether one field passes (values within a field OR together), and
// `passes` requires every field to pass (fields AND together).
//
// Applied in the order the spec defines:
// visibility (HIDE_FIELDS) -> color (metric) -> greyscale (GREY_FIELDS).

import { GREY_FIELDS, HIDE_FIELDS, NONE } from './filterSchema';

function withinMonths(isoDate, months, now) {
  if (!isoDate) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return new Date(`${isoDate}T00:00:00`) >= cutoff;
}

const matchers = {
  multi: (value, selected) =>
    selected.length === 0 || selected.includes(value ?? NONE),
  range: (value, [min, max]) => value >= min && value <= max,
  threshold: (value, { enabled, value: min }) => !enabled || value >= min,
  recency: (value, months, _field, ctx) =>
    months == null || withinMonths(value, months, ctx.now),
};

export function passes(fields, props, state, ctx) {
  return fields.every((field) =>
    matchers[field.kind](field.get(props, ctx), state[field.key], field, ctx)
  );
}

// Visibility: hides non-matching buildings.
export function passesVisibility(props, state, ctx) {
  return passes(HIDE_FIELDS, props, state, ctx);
}

// Confidence: failing any active criterion greys the building out, never hides
// it. `ctx.now` is captured once at app load.
export function passesConfidence(props, state, ctx) {
  return passes(GREY_FIELDS, props, state, ctx);
}

export function searchMatches(props, query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (
    props.name.toLowerCase().includes(q) ||
    props.address.toLowerCase().includes(q) ||
    props.id.toLowerCase().includes(q)
  );
}
