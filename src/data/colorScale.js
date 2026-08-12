// Shared color-band and height-scale logic. Band labels vary by goal program;
// tones always resolve to the same four palette slots so the map stays coherent.

import { DERIVED_METRICS } from './derivedMetrics';

/** Metrics carried by the Baseline & Targets sheet, with a baseline and a target. */
export const SHEET_METRICS = [
  { key: 'energyStar', label: 'ENERGY STAR Score', type: 'fixed' },
  { key: 'ghg', label: 'GHG Emissions (Scope 1+2)', type: 'trajectory' },
  { key: 'eui', label: 'EUI (kWh/sq ft)', type: 'trajectory' },
  { key: 'waste', label: 'Waste Diversion Rate', type: 'fixed' },
  { key: 'water', label: 'Water Use', type: 'trajectory' },
  { key: 'coverage', label: 'Data Coverage', type: 'fixed' },
];

// Display order for every metric a program can govern. Derived predicates sort
// after the metered metrics so the sheet metrics keep the order they had.
export const METRICS = [...SHEET_METRICS, ...DERIVED_METRICS];

export const SHEET_METRIC_KEYS = SHEET_METRICS.map((m) => m.key);

export function metricMeta(key) {
  return METRICS.find((entry) => entry.key === key) ?? null;
}

// Palette is intentional — not ColorBrewer RdYlGn traffic lights. Garnet →
// burnt ochre → leaf green → forest green: mineral / institutional, AA white
// text on chips, and a clear green read for On Track / Target Met / Ahead.
// Keep in sync with --band-* in styles.css.
export const BAND_TONES = {
  worst: { color: [159, 45, 66], hex: '#9f2d42' },
  warn: { color: [154, 90, 28], hex: '#9a5a1c' },
  good: { color: [27, 143, 78], hex: '#1b8f4e' },
  best: { color: [15, 107, 58], hex: '#0f6b3a' },
};

/** Classic trajectory / composite vocabulary (worst → best). */
export const BANDS = [
  { key: 'Off Track', tone: 'worst', ...BAND_TONES.worst },
  { key: 'At Risk', tone: 'warn', ...BAND_TONES.warn },
  { key: 'On Track', tone: 'good', ...BAND_TONES.good },
  { key: 'Target Met', tone: 'best', ...BAND_TONES.best },
];

export const GREY = [158, 163, 172];

const BAND_BY_KEY = Object.fromEntries(BANDS.map((b) => [b.key, b]));

/** Register program-specific band labels onto the shared palette tones. */
export function registerBandColors(bands) {
  for (const band of bands) {
    const tone = BAND_TONES[band.tone];
    if (!tone) continue;
    BAND_BY_KEY[band.key] = {
      key: band.key,
      tone: band.tone,
      color: tone.color,
      hex: tone.hex,
      meaning: band.meaning,
    };
  }
}

export function bandColor(bandLabel) {
  return BAND_BY_KEY[bandLabel]?.color ?? GREY;
}

export function bandHex(bandLabel) {
  return BAND_BY_KEY[bandLabel]?.hex ?? '#9ea3ac';
}

export function bandCss(bandLabel) {
  const [r, g, b] = bandColor(bandLabel);
  return `rgb(${r}, ${g}, ${b})`;
}

export function bandTone(bandLabel) {
  return BAND_BY_KEY[bandLabel]?.tone ?? null;
}

// --- Column height: sqrt-normalized floor count -------------------------------
// The portfolio spans 1-floor warehouses to 25-floor towers, clustered at 1-3.
// A sqrt scale expands the low end so the industrial assets stay visually
// distinguishable; min/max floors are derived from the loaded dataset.

export const MIN_VISUAL_HEIGHT = 150; // meters, stylized
export const MAX_VISUAL_HEIGHT = 1200;

export function heightForFloors(floors, minFloors, maxFloors) {
  if (maxFloors <= minFloors) return MIN_VISUAL_HEIGHT;
  const t =
    (Math.sqrt(floors) - Math.sqrt(minFloors)) /
    (Math.sqrt(maxFloors) - Math.sqrt(minFloors));
  return MIN_VISUAL_HEIGHT + t * (MAX_VISUAL_HEIGHT - MIN_VISUAL_HEIGHT);
}
