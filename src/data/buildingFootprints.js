// Generate small rectangular footprints centered on each asset coordinate.
// Footprint size is meters-based with pixel clamps so blocks stay visible
// zoomed out without merging into neighbors zoomed in.

const BASE_HALF_WIDTH_M = 14;
const BASE_HALF_DEPTH_M = 10;
const HALF_EXTENT_MIN_PX = 4;
const HALF_EXTENT_MAX_PX = 20;

const FLOOR_AREA_SQRT_MIN = Math.sqrt(57_000);
const FLOOR_AREA_SQRT_MAX = Math.sqrt(711_000);

export function metersPerPixel(latitude, zoom) {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

function clampHalfExtentMeters(halfExtentM, zoom, latitude) {
  const mpp = metersPerPixel(latitude, zoom);
  return Math.min(
    Math.max(halfExtentM, HALF_EXTENT_MIN_PX * mpp),
    HALF_EXTENT_MAX_PX * mpp
  );
}

function areaScale(floorArea) {
  const sqrtArea = Math.sqrt(floorArea);
  const t =
    (sqrtArea - FLOOR_AREA_SQRT_MIN) / (FLOOR_AREA_SQRT_MAX - FLOOR_AREA_SQRT_MIN);
  return 0.9 + Math.min(Math.max(t, 0), 1) * 0.25;
}

export function footprintMetersForFeature(feature, zoom, latitude = 42.4) {
  const [lng, lat] = feature.geometry.coordinates;
  const latForMpp = lat ?? latitude;
  const scale = areaScale(feature.properties.floorArea);

  const halfWidthM = clampHalfExtentMeters(BASE_HALF_WIDTH_M * scale, zoom, latForMpp);
  const halfDepthM = clampHalfExtentMeters(BASE_HALF_DEPTH_M * scale, zoom, latForMpp);

  return { halfWidthM, halfDepthM, lng, lat: latForMpp };
}

export function rectangleFootprint(lng, lat, halfWidthM, halfDepthM) {
  const latRad = (lat * Math.PI) / 180;
  const dLng = halfWidthM / (111320 * Math.cos(latRad));
  const dLat = halfDepthM / 110540;

  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

export function featuresToExtrudedPolygons(features, zoom, latitude = 42.4) {
  return features.map((feature) => {
    const { halfWidthM, halfDepthM, lng, lat } = footprintMetersForFeature(
      feature,
      zoom,
      latitude
    );

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [rectangleFootprint(lng, lat, halfWidthM, halfDepthM)],
      },
      properties: feature.properties,
    };
  });
}

export function selectedHighlightPolygon(feature, zoom, latitude = 42.4, scale = 1.15) {
  const { halfWidthM, halfDepthM, lng, lat } = footprintMetersForFeature(
    feature,
    zoom,
    latitude
  );

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        rectangleFootprint(lng, lat, halfWidthM * scale, halfDepthM * scale),
      ],
    },
    properties: {},
  };
}
