function hasLayer(map, id) {
  return Boolean(map.getLayer(id));
}

function setPaint(map, id, prop, value) {
  if (hasLayer(map, id)) map.setPaintProperty(id, prop, value);
}

function setLayout(map, id, prop, value) {
  if (hasLayer(map, id)) map.setLayoutProperty(id, prop, value);
}

/** Boost Positron roads/water visibility for regional portfolio context. */
export function enhanceBasemap(map) {
  setPaint(map, 'water', 'fill-color', 'rgb(170, 195, 210)');

  setPaint(map, 'waterway', 'line-color', 'rgb(120, 155, 180)');
  setPaint(map, 'waterway', 'line-width', [
    'interpolate',
    ['linear'],
    ['zoom'],
    5,
    0.6,
    8,
    1.2,
    12,
    2,
  ]);

  setPaint(map, 'highway_motorway_inner', 'line-color', 'rgb(200, 200, 200)');
  setPaint(map, 'highway_motorway_casing', 'line-color', 'rgb(160, 160, 160)');
  setPaint(map, 'highway_motorway_subtle', 'line-color', 'hsla(0,0%,55%,0.75)');
  setPaint(map, 'highway_motorway_subtle', 'line-width', [
    'interpolate',
    ['exponential', 1.4],
    ['zoom'],
    4,
    1.5,
    6,
    2,
  ]);

  setPaint(map, 'highway_major_inner', 'line-color', 'rgb(230, 230, 230)');
  setPaint(map, 'highway_major_casing', 'line-color', 'rgb(170, 170, 170)');
  setPaint(map, 'highway_major_subtle', 'line-color', 'hsla(0,0%,55%,0.8)');
  setPaint(map, 'highway_major_subtle', 'line-width', 2.5);

  setPaint(map, 'water_name_point_label', 'text-color', '#3d5a80');
  setPaint(map, 'water_name_line_label', 'text-color', '#3d5a80');
  setLayout(map, 'water_name_point_label', 'text-size', [
    'interpolate',
    ['linear'],
    ['zoom'],
    5,
    11,
    9,
    14,
  ]);
  setLayout(map, 'waterway_line_label', 'text-size', 13);
  setLayout(map, 'waterway_line_label', 'minzoom', 8);

  setLayout(map, 'road_shield_us', 'minzoom', 9);
  setLayout(map, 'highway-shield-us-interstate', 'minzoom', 6);
}
