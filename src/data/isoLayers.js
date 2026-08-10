import {
  AmbientLight,
  COORDINATE_SYSTEM,
  DirectionalLight,
  LightingEffect,
} from '@deck.gl/core';
import { ColumnLayer, PathLayer, PolygonLayer, TextLayer } from '@deck.gl/layers';

import { bandColor, GREY } from './colorScale';
import { CELL_SIZE, sceneHeightForFloors } from './isoLayout';

const COLUMN_HALF = CELL_SIZE * 0.38;
const RECT_VERTICES = [
  [-COLUMN_HALF, -COLUMN_HALF],
  [COLUMN_HALF, -COLUMN_HALF],
  [COLUMN_HALF, COLUMN_HALF],
  [-COLUMN_HALF, COLUMN_HALF],
];

// High ambient keeps band colors readable; light diffuse still separates faces.
const COLUMN_MATERIAL = {
  ambient: 0.75,
  diffuse: 0.45,
  shininess: 4,
  specularColor: [20, 20, 20],
};

export const isoLightingEffect = new LightingEffect({
  ambient: new AmbientLight({
    color: [255, 255, 255],
    intensity: 1.15,
  }),
  // Soft key from top-left for three-tone faces without crushing hue.
  keyLight: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 0.55,
    direction: [-1.0, -1.4, -0.8],
  }),
  // Gentle fill so shadowed faces stay distinguishable by band color.
  fillLight: new DirectionalLight({
    color: [255, 255, 255],
    intensity: 0.35,
    direction: [1.0, 0.4, -0.5],
  }),
});

function withAlpha(rgb, alpha) {
  const [r, g, b] = rgb;
  return [r, g, b, alpha];
}

/** Soften columns slightly so neighbors read through edges without muddying bands. */
const COLUMN_FILL_ALPHA = 220;
const COLUMN_DIMMED_ALPHA = 50;

export function createFloorGridLayer(gridPaths) {
  return new PathLayer({
    id: 'iso-floor-grid',
    data: gridPaths,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    getPath: (d) => d.path,
    getColor: [180, 188, 198, 90],
    getWidth: 1,
    widthUnits: 'pixels',
    pickable: false,
  });
}

export function createIsoClusterLabelsLayer(groups) {
  if (!groups?.length) return null;

  return new TextLayer({
    id: 'iso-cluster-labels',
    data: groups,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    pickable: false,
    billboard: true,
    getPosition: (d) => d.labelPosition,
    getText: (d) => d.type,
    getSize: 12,
    sizeUnits: 'pixels',
    getColor: [71, 85, 105, 220],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    outlineWidth: 2,
    outlineColor: [247, 246, 243, 230],
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 500,
  });
}

export function createIsoColumnsLayer(cells, options) {
  const { bandFor, isGreyed, isMetricDimmed, minFloors, maxFloors, onHover, onClick } = options;

  return new ColumnLayer({
    id: 'iso-columns',
    data: cells,
    coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
    diskResolution: 4,
    vertices: RECT_VERTICES,
    radius: COLUMN_HALF,
    extruded: true,
    pickable: true,
    material: COLUMN_MATERIAL,
    getPosition: (d) => [d.x, d.y],
    getElevation: (d) =>
      sceneHeightForFloors(d.feature.properties.floors, minFloors, maxFloors),
    getFillColor: (d) => {
      const props = d.feature.properties;
      const base = isGreyed(props) ? GREY : bandColor(bandFor(props));
      const alpha = isMetricDimmed?.(props) ? COLUMN_DIMMED_ALPHA : COLUMN_FILL_ALPHA;
      return withAlpha(base, alpha);
    },
    onHover,
    onClick,
    updateTriggers: {
      getElevation: [minFloors, maxFloors],
      getFillColor: [bandFor, isGreyed, isMetricDimmed],
    },
  });
}

export function createIsoSelectionLayer(cell, minFloors, maxFloors) {
  if (!cell) return null;

  const h = sceneHeightForFloors(cell.feature.properties.floors, minFloors, maxFloors);
  const pad = COLUMN_HALF + 0.06;
  const { x, y } = cell;

  // Thin open box outline around the selected column (floor ring + vertical edges).
  const ring = [
    [x - pad, y - pad, 0],
    [x + pad, y - pad, 0],
    [x + pad, y + pad, 0],
    [x - pad, y + pad, 0],
    [x - pad, y - pad, 0],
  ];

  const uprights = [
    {
      path: [
        [x - pad, y - pad, 0],
        [x - pad, y - pad, h],
      ],
    },
    {
      path: [
        [x + pad, y - pad, 0],
        [x + pad, y - pad, h],
      ],
    },
    {
      path: [
        [x + pad, y + pad, 0],
        [x + pad, y + pad, h],
      ],
    },
    {
      path: [
        [x - pad, y + pad, 0],
        [x - pad, y + pad, h],
      ],
    },
    {
      path: [
        [x - pad, y - pad, h],
        [x + pad, y - pad, h],
        [x + pad, y + pad, h],
        [x - pad, y + pad, h],
        [x - pad, y - pad, h],
      ],
    },
  ];

  return [
    new PathLayer({
      id: 'iso-selected-ring',
      data: [{ path: ring }],
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPath: (d) => d.path,
      getColor: [37, 99, 235, 230],
      getWidth: 2,
      widthUnits: 'pixels',
      pickable: false,
    }),
    new PathLayer({
      id: 'iso-selected-uprights',
      data: uprights,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPath: (d) => d.path,
      getColor: [37, 99, 235, 200],
      getWidth: 1.5,
      widthUnits: 'pixels',
      pickable: false,
    }),
    // Soft floor pad under selection for readability when zoomed out.
    new PolygonLayer({
      id: 'iso-selected-pad',
      data: [
        {
          polygon: [
            [x - pad, y - pad],
            [x + pad, y - pad],
            [x + pad, y + pad],
            [x - pad, y + pad],
          ],
        },
      ],
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPolygon: (d) => d.polygon,
      stroked: false,
      filled: true,
      getFillColor: [37, 99, 235, 35],
      pickable: false,
    }),
  ];
}
