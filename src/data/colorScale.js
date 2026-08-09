// Shared color-band and height-scale logic. The Legend reads BANDS directly so
// the key always matches what the map renders.

export const METRICS = [
  { key: 'energyStar', label: 'ENERGY STAR Score', type: 'fixed' },
  { key: 'ghg', label: 'GHG Emissions (Scope 1+2)', type: 'trajectory' },
  { key: 'eui', label: 'EUI (kWh/sq ft)', type: 'trajectory' },
  { key: 'waste', label: 'Waste Diversion Rate', type: 'fixed' },
  { key: 'water', label: 'Water Use', type: 'trajectory' },
  { key: 'coverage', label: 'Data Coverage', type: 'fixed' },
];

export const DEFAULT_METRIC = 'energyStar';

// Band thresholds live in scripts/prepare_data.py (bands are precomputed into
// buildings.geojson, direction-adjusted and clamped). Order: worst -> best.
export const BANDS = [
  { key: 'Off Track', color: [215, 48, 39] },
  { key: 'At Risk', color: [253, 174, 97] },
  { key: 'On Track', color: [166, 217, 106] },
  { key: 'Target Met', color: [26, 152, 80] },
];

export const GREY = [158, 163, 172];

const BAND_BY_KEY = Object.fromEntries(BANDS.map((b) => [b.key, b]));

export function bandColor(bandLabel) {
  return BAND_BY_KEY[bandLabel]?.color ?? GREY;
}

export function bandCss(bandLabel) {
  const [r, g, b] = bandColor(bandLabel);
  return `rgb(${r}, ${g}, ${b})`;
}

export function colorForFeature(props, metricKey) {
  return bandColor(props.metrics?.[metricKey]?.band);
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
