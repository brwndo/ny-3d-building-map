import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { bandColor, GREY } from './colorScale';
import { radiusForFloorArea } from './buildingFootprints';
import { createOutsideMaskFeature } from './geoMask';

// Soft whiteout outside NY so basemap context remains faintly visible but
// the focused state is unmistakable.
const OUTSIDE_MASK_OPACITY = 145;

export function createOutsideMaskLayer(boundary) {
  const feature = createOutsideMaskFeature(boundary);
  if (!feature) return null;

  return new GeoJsonLayer({
    id: 'outside-mask',
    data: feature,
    pickable: false,
    stroked: false,
    filled: true,
    getFillColor: [248, 248, 248, OUTSIDE_MASK_OPACITY],
  });
}

export function createCountyBoundariesLayer(counties, zoom) {
  if (!counties || zoom < 7) return null;

  return new GeoJsonLayer({
    id: 'county-boundaries',
    data: counties,
    pickable: false,
    stroked: true,
    filled: false,
    getLineColor: [200, 200, 200, zoom < 8 ? 70 : 110],
    lineWidthMinPixels: 1,
    getDashArray: [4, 3],
    dashJustified: true,
  });
}

export function createCountyLabelsLayer(counties, zoom) {
  if (!counties || zoom < 8) return null;

  const opacity = zoom < 8.5 ? Math.round((zoom - 8) * 300) : 180;

  return new TextLayer({
    id: 'county-labels',
    data: counties.features,
    pickable: false,
    getPosition: (f) => [f.properties.labelLng, f.properties.labelLat],
    getText: (f) => f.properties.name,
    getSize: zoom < 9 ? 11 : 12,
    getColor: [51, 51, 51, opacity],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    outlineWidth: 2,
    outlineColor: [255, 255, 255, Math.min(255, opacity + 50)],
    fontFamily: 'Geist Sans, system-ui, sans-serif',
    fontWeight: 400,
  });
}

export function createBoundaryLayer(boundary) {
  return new GeoJsonLayer({
    id: 'ny-boundary',
    data: boundary,
    stroked: true,
    filled: false,
    getLineColor: [120, 120, 120, 220],
    lineWidthMinPixels: 1.75,
  });
}

function withAlpha(rgb, alpha) {
  const [r, g, b] = rgb;
  return [r, g, b, alpha];
}

function areaBounds(features) {
  const areas = features
    .map((f) => f.properties.floorArea)
    .filter((v) => v != null && Number.isFinite(v));
  if (!areas.length) return { minArea: 57_000, maxArea: 711_000 };
  return { minArea: Math.min(...areas), maxArea: Math.max(...areas) };
}

/** Circular asset dots — color = goal band, radius = floor area (sq ft). */
export function createAssetDotsLayer(features, options) {
  const { bandFor, isGreyed, isMetricDimmed, onHover, onClick } = options;
  const { minArea, maxArea } = areaBounds(features);

  return new ScatterplotLayer({
    id: 'asset-dots',
    data: features,
    pickable: true,
    opacity: 1,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    getPosition: (f) => f.geometry.coordinates,
    getRadius: (f) => radiusForFloorArea(f.properties.floorArea, minArea, maxArea),
    getFillColor: (f) => {
      const base = isGreyed(f.properties) ? GREY : bandColor(bandFor(f.properties));
      const alpha = isMetricDimmed?.(f.properties) ? 55 : 230;
      return withAlpha(base, alpha);
    },
    getLineColor: (f) =>
      isMetricDimmed?.(f.properties) ? [255, 255, 255, 50] : [255, 255, 255, 200],
    getLineWidth: 1.25,
    onHover,
    onClick,
    updateTriggers: {
      getRadius: [minArea, maxArea],
      getFillColor: [bandFor, isGreyed, isMetricDimmed],
      getLineColor: [isMetricDimmed],
    },
  });
}

export function createSelectedHighlightLayer(feature, features) {
  if (!feature) return null;

  const { minArea, maxArea } = areaBounds(features?.length ? features : [feature]);
  const radius = radiusForFloorArea(feature.properties.floorArea, minArea, maxArea) + 4;

  return new ScatterplotLayer({
    id: 'selected-highlight',
    data: [feature],
    pickable: false,
    stroked: true,
    filled: false,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (f) => f.geometry.coordinates,
    getRadius: radius,
    getLineColor: [37, 99, 235, 255],
    getLineWidth: 2.5,
    getFillColor: [0, 0, 0, 0],
  });
}
