const WORLD_BBOX = [-180, -85, 180, 85];

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return area / 2;
}

function reverseRing(ring) {
  return [...ring].reverse();
}

function ensureWinding(ring, clockwise) {
  const isClockwise = ringArea(ring) < 0;
  if (isClockwise !== clockwise) return reverseRing(ring);
  return ring;
}

function outerRingsFromGeometry(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly[0]);
  return [];
}

/** Build an inverse mask: world fill with NY state cut out as holes. */
export function createOutsideMaskFeature(boundaryCollection) {
  const nyFeature = boundaryCollection.features[0];
  if (!nyFeature) return null;

  const outer = ensureWinding(
    [
      [WORLD_BBOX[0], WORLD_BBOX[1]],
      [WORLD_BBOX[2], WORLD_BBOX[1]],
      [WORLD_BBOX[2], WORLD_BBOX[3]],
      [WORLD_BBOX[0], WORLD_BBOX[3]],
      [WORLD_BBOX[0], WORLD_BBOX[1]],
    ],
    false
  );

  const holes = outerRingsFromGeometry(nyFeature.geometry).map((ring) =>
    ensureWinding(ring, true)
  );

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [outer, ...holes],
    },
  };
}
