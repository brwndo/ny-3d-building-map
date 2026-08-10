/**
 * MapLibre port of Snazzy Maps "Ultra Light with Labels"
 * https://snazzymaps.com/style/151/ultra-light-with-labels
 *
 * Google stylers → flat hex (lightness baked into the published look):
 *   water #e9e9e9 · landscape #f5f5f5 · roads #ffffff · parks #dedede
 *   labels #333333 + white halo · icons off · transit #f2f2f2
 */

function hasLayer(map, id) {
  return Boolean(map.getLayer(id));
}

function setPaint(map, id, prop, value) {
  if (!hasLayer(map, id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    // Unsupported paint prop for this layer type.
  }
}

function setLayout(map, id, prop, value) {
  if (!hasLayer(map, id)) return;
  try {
    map.setLayoutProperty(id, prop, value);
  } catch {
    // Unsupported layout prop.
  }
}

function hide(map, id) {
  setLayout(map, id, 'visibility', 'none');
}

// Snazzy Ultra Light palette
const LAND = '#f5f5f5';
const WATER = '#e9e9e9';
const PARK = '#dedede';
const ROAD = '#ffffff';
const ROAD_CASING = '#ffffff';
const TRANSIT = '#f2f2f2';
const ADMIN_FILL = '#fefefe';
const ADMIN_STROKE = '#fefefe';
const LABEL_FILL = '#333333';
const LABEL_HALO = '#ffffff';

/** Texture / POI layers — Ultra Light keeps land flat; icons off. */
const HIDE_IDS = [
  'natural_earth',
  'landcover_ice_shelf',
  'landcover_glacier',
  'landcover_wood',
  'landcover_grass',
  'landcover_ice',
  'landcover_wetland',
  'landcover_sand',
  'landuse_residential',
  'landuse_pitch',
  'landuse_track',
  'landuse_cemetery',
  'landuse_hospital',
  'landuse_school',
  'building',
  'building-3d',
  'aeroway-area',
  'aeroway-taxiway',
  'aeroway-runway',
  'aeroway-runway-casing',
  'aeroway_fill',
  'aeroway_runway',
  'aeroway_taxiway',
  'road_area_pattern',
  'poi_r20',
  'poi_r7',
  'poi_r1',
  'poi_transit',
  'airport',
  'road_one_way_arrow',
  'road_one_way_arrow_opposite',
  'highway-shield-non-us',
  'highway-shield-us-interstate',
  'road_shield_us',
];

function isRoadLike(id) {
  return /^(highway_|road_|tunnel_|bridge_|aeroway)/.test(id) || id.includes('pier');
}

function isTransit(id) {
  return id.includes('railway') || id.includes('transit') || id.includes('rail');
}

function isCasing(id) {
  return id.includes('casing') || id.includes('subtle');
}

/**
 * Apply Ultra Light with Labels to the active OpenFreeMap style (Positron).
 * Walks every layer so zoom-dependent orange/green paints cannot reappear.
 */
export function enhanceBasemap(map) {
  const style = map.getStyle?.();
  if (!style?.layers) return;

  setPaint(map, 'background', 'background-color', LAND);

  for (const id of HIDE_IDS) hide(map, id);

  // Water — soft gray, distinct from land
  setPaint(map, 'water', 'fill-color', WATER);
  setPaint(map, 'waterway', 'line-color', WATER);
  setPaint(map, 'waterway_river', 'line-color', WATER);
  setPaint(map, 'waterway_other', 'line-color', WATER);
  setPaint(map, 'waterway_tunnel', 'line-color', WATER);

  // Parks — slightly darker gray blocks (Snazzy poi.park)
  setPaint(map, 'park', 'fill-color', PARK);
  setPaint(map, 'park', 'fill-opacity', 1);
  setPaint(map, 'park', 'fill-outline-color', PARK);
  setPaint(map, 'park_outline', 'line-color', PARK);

  for (const layer of style.layers) {
    const { id, type, paint } = layer;
    if (!paint) continue;

    if (type === 'fill' && (id === 'building' || id.startsWith('landuse') || id.startsWith('landcover'))) {
      hide(map, id);
      continue;
    }

    if (type === 'line' && isRoadLike(id)) {
      if (isTransit(id)) {
        setPaint(map, id, 'line-color', TRANSIT);
      } else if (isCasing(id)) {
        setPaint(map, id, 'line-color', ROAD_CASING);
      } else {
        setPaint(map, id, 'line-color', ROAD);
      }
    }

    if (type === 'fill' && (id.includes('pier') || id.includes('road_area'))) {
      setPaint(map, id, 'fill-color', LAND);
    }

    if (type === 'line' && id.startsWith('boundary')) {
      setPaint(map, id, 'line-color', ADMIN_STROKE);
      setPaint(map, id, 'line-opacity', 0.85);
    }

    if (type === 'fill' && id.startsWith('boundary')) {
      setPaint(map, id, 'fill-color', ADMIN_FILL);
    }

    if (type === 'symbol') {
      // labels.text.fill / stroke; icons already hidden above
      if ('text-color' in paint) setPaint(map, id, 'text-color', LABEL_FILL);
      if ('text-halo-color' in paint) setPaint(map, id, 'text-halo-color', LABEL_HALO);
      if ('text-halo-width' in paint) setPaint(map, id, 'text-halo-width', 1.2);
      if ('icon-opacity' in paint) setPaint(map, id, 'icon-opacity', 0);
    }
  }
}
