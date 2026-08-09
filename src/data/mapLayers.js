import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { colorForFeature, GREY } from './colorScale';
import { selectedHighlightPolygon } from './buildingFootprints';
import { createOutsideMaskFeature } from './geoMask';

const OUTSIDE_MASK_OPACITY = 140;

export function createOutsideMaskLayer(boundary) {
  const feature = createOutsideMaskFeature(boundary);
  if (!feature) return null;

  return new GeoJsonLayer({
    id: 'outside-mask',
    data: feature,
    pickable: false,
    stroked: false,
    filled: true,
    getFillColor: [255, 255, 255, OUTSIDE_MASK_OPACITY],
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
    getLineColor: [148, 163, 184, zoom < 8 ? 120 : 200],
    lineWidthMinPixels: 1,
    getDashArray: [4, 3],
    dashJustified: true,
  });
}

export function createCountyLabelsLayer(counties, zoom) {
  if (!counties || zoom < 7.5) return null;

  const opacity = zoom < 8 ? Math.round((zoom - 7.5) * 400) : 220;

  return new TextLayer({
    id: 'county-labels',
    data: counties.features,
    pickable: false,
    getPosition: (f) => [f.properties.labelLng, f.properties.labelLat],
    getText: (f) => f.properties.name,
    getSize: zoom < 9 ? 11 : 13,
    getColor: [71, 85, 105, opacity],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    outlineWidth: 2,
    outlineColor: [255, 255, 255, Math.min(255, opacity + 35)],
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
  });
}

export function createBoundaryLayer(boundary) {
  return new GeoJsonLayer({
    id: 'ny-boundary',
    data: boundary,
    stroked: true,
    filled: false,
    getLineColor: [100, 116, 139, 180],
    lineWidthMinPixels: 1.5,
  });
}

export function createBuildingsLayer(polygonFeatures, options) {
  const { metricKey, isGreyed, onHover, onClick } = options;

  return new GeoJsonLayer({
    id: 'buildings',
    data: { type: 'FeatureCollection', features: polygonFeatures },
    extruded: false,
    pickable: true,
    stroked: true,
    filled: true,
    getFillColor: (f) =>
      isGreyed(f.properties) ? GREY : colorForFeature(f.properties, metricKey),
    getLineColor: [255, 255, 255, 180],
    lineWidthMinPixels: 1,
    onHover,
    onClick,
    updateTriggers: {
      getFillColor: [metricKey, isGreyed],
    },
  });
}

export function createSelectedHighlightLayer(feature, zoom, latitude) {
  if (!feature) return null;

  return new GeoJsonLayer({
    id: 'selected-highlight',
    data: selectedHighlightPolygon(feature, zoom, latitude),
    pickable: false,
    extruded: false,
    filled: false,
    stroked: true,
    getLineColor: [37, 99, 235, 255],
    lineWidthMinPixels: 2,
  });
}
