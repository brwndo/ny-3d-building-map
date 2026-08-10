// Pack visible assets onto an abstract XY grid, grouped by property type.
// Groups start at the origin and grow left-to-right with row wrap when wide.

import {
  heightForFloors,
  MIN_VISUAL_HEIGHT,
  MAX_VISUAL_HEIGHT,
} from './colorScale';

/** World-space pitch between column centers. */
export const CELL_SIZE = 1.15;

/** Extra empty cells between property-type clusters. */
export const GROUP_GUTTER = 1.5;

/** Soft cap on group-row width before wrapping to the next band of groups. */
const MAX_GROUP_ROW_CELLS = 14;

export const MIN_SCENE_HEIGHT = 0.75;
export const MAX_SCENE_HEIGHT = 10;

export function sceneHeightForFloors(floors, minFloors, maxFloors) {
  const meters = heightForFloors(floors, minFloors, maxFloors);
  if (MAX_VISUAL_HEIGHT <= MIN_VISUAL_HEIGHT) return MIN_SCENE_HEIGHT;
  const t = (meters - MIN_VISUAL_HEIGHT) / (MAX_VISUAL_HEIGHT - MIN_VISUAL_HEIGHT);
  return MIN_SCENE_HEIGHT + Math.min(Math.max(t, 0), 1) * (MAX_SCENE_HEIGHT - MIN_SCENE_HEIGHT);
}

function groupKey(feature) {
  return feature.properties.propertyType || 'Unknown';
}

function packSquare(count) {
  return Math.max(1, Math.ceil(Math.sqrt(count)));
}

/**
 * @param {object[]} features - visible GeoJSON features
 * @returns {{
 *   cells: Array<{ feature: object, x: number, y: number, id: string }>,
 *   byId: Map<string, { x: number, y: number }>,
 *   groups: Array<{ type: string, count: number, origin: [number, number] }>,
 *   extent: { minX: number, maxX: number, minY: number, maxY: number },
 *   center: [number, number, number],
 * }}
 */
export function layoutIsoFeatures(features) {
  if (!features.length) {
    return {
      cells: [],
      byId: new Map(),
      groups: [],
      extent: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      center: [0, 0, 0],
    };
  }

  const buckets = new Map();
  for (const feature of features) {
    const key = groupKey(feature);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(feature);
  }

  const types = [...buckets.keys()].sort((a, b) => a.localeCompare(b));
  for (const type of types) {
    buckets.get(type).sort((a, b) => a.properties.id.localeCompare(b.properties.id));
  }

  const cells = [];
  const byId = new Map();
  const groups = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let rowWidth = 0;

  for (const type of types) {
    const members = buckets.get(type);
    const cols = packSquare(members.length);
    const rows = Math.ceil(members.length / cols);
    const blockW = cols * CELL_SIZE;
    const blockH = rows * CELL_SIZE;

    // Wrap to a new group-row when the next cluster would overrun the soft width.
    if (rowWidth > 0 && (rowWidth + GROUP_GUTTER + blockW) / CELL_SIZE > MAX_GROUP_ROW_CELLS) {
      cursorX = 0;
      cursorY += rowHeight + GROUP_GUTTER;
      rowHeight = 0;
      rowWidth = 0;
    }

    if (rowWidth > 0) {
      cursorX += GROUP_GUTTER;
    }

    const originX = cursorX;
    const originY = cursorY;
    // Label sits just outside the near edge of the block, centered on its width.
    groups.push({
      type,
      count: members.length,
      origin: [originX, originY],
      cols,
      rows,
      labelPosition: [
        originX + ((cols - 1) * CELL_SIZE) / 2,
        originY - CELL_SIZE * 0.55,
        0,
      ],
    });

    members.forEach((feature, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = originX + col * CELL_SIZE;
      const y = originY + row * CELL_SIZE;
      const id = feature.properties.id;
      cells.push({ feature, x, y, id });
      byId.set(id, { x, y });
    });

    cursorX = originX + blockW;
    rowWidth = cursorX;
    rowHeight = Math.max(rowHeight, blockH);
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cell of cells) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }

  return {
    cells,
    byId,
    groups,
    extent: { minX, maxX, minY, maxY },
    center: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
  };
}

/** Build floor-grid line segments covering the packed extent (plus padding). */
export function buildFloorGridPaths(extent, padding = 2) {
  const paths = [];
  if (!Number.isFinite(extent.minX)) return paths;

  const x0 = extent.minX - padding * CELL_SIZE;
  const x1 = extent.maxX + padding * CELL_SIZE;
  const y0 = extent.minY - padding * CELL_SIZE;
  const y1 = extent.maxY + padding * CELL_SIZE;

  const startX = Math.floor(x0 / CELL_SIZE) * CELL_SIZE;
  const startY = Math.floor(y0 / CELL_SIZE) * CELL_SIZE;

  for (let x = startX; x <= x1 + 1e-6; x += CELL_SIZE) {
    paths.push({
      path: [
        [x, y0, 0],
        [x, y1, 0],
      ],
    });
  }
  for (let y = startY; y <= y1 + 1e-6; y += CELL_SIZE) {
    paths.push({
      path: [
        [x0, y, 0],
        [x1, y, 0],
      ],
    });
  }

  return paths;
}

export function fitZoomForExtent(extent, viewportWidth, viewportHeight) {
  const width = Math.max(extent.maxX - extent.minX, CELL_SIZE) + CELL_SIZE * 4;
  const height = Math.max(extent.maxY - extent.minY, CELL_SIZE) + CELL_SIZE * 4;
  const vw = Math.max(viewportWidth || 800, 1);
  const vh = Math.max(viewportHeight || 600, 1);
  // Orthographic OrbitView: zoom 0 → 1 world unit = 1 px.
  const zoomX = Math.log2(vw / width);
  const zoomY = Math.log2(vh / height);
  return Math.min(zoomX, zoomY) - 0.35;
}
