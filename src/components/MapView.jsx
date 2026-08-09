import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ColumnLayer, GeoJsonLayer } from '@deck.gl/layers';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapState } from '../context/MapStateContext';
import { colorForFeature, GREY, heightForFloors } from '../data/colorScale';
import HoverPopup from './HoverPopup';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
// Camera stays inside NY (with a margin); the base map still renders neighbors.
const NY_MAX_BOUNDS = [
  [-81.0, 39.8],
  [-70.2, 45.6],
];
const INITIAL_VIEW = { longitude: -75.0, latitude: 42.4, zoom: 6.3, pitch: 50, bearing: 0 };

// Footprint sizing: meters-based with pixel clamps so columns stay a visible
// dot zoomed out and don't fill the screen zoomed in.
const BASE_RADIUS_M = 120;
const RADIUS_MIN_PX = 4;
const RADIUS_MAX_PX = 40;

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
}

function clampedRadius(zoom, latitude) {
  const metersPerPixel =
    (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
  return Math.min(
    Math.max(BASE_RADIUS_M, RADIUS_MIN_PX * metersPerPixel),
    RADIUS_MAX_PX * metersPerPixel
  );
}

export default function MapView() {
  const {
    boundary,
    visibleFeatures,
    datasetBounds,
    metricKey,
    isGreyed,
    setSelectedId,
    flyToRequest,
  } = useMapState();

  const mapRef = useRef(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    if (flyToRequest && mapRef.current) {
      mapRef.current.flyTo({
        center: flyToRequest.coords,
        zoom: 13,
        pitch: 50,
        duration: 1400,
      });
    }
  }, [flyToRequest]);

  const radius = clampedRadius(viewState.zoom, viewState.latitude);

  const layers = useMemo(() => {
    return [
      new GeoJsonLayer({
        id: 'ny-boundary',
        data: boundary,
        stroked: true,
        filled: false,
        getLineColor: [100, 116, 139, 180],
        lineWidthMinPixels: 1.5,
      }),
      new ColumnLayer({
        id: 'buildings',
        data: visibleFeatures,
        diskResolution: 24,
        extruded: true,
        pickable: true,
        radius,
        getPosition: (f) => f.geometry.coordinates,
        getElevation: (f) =>
          heightForFloors(f.properties.floors, datasetBounds.minFloors, datasetBounds.maxFloors),
        getFillColor: (f) =>
          isGreyed(f.properties) ? GREY : colorForFeature(f.properties, metricKey),
        onHover: (info) => setHoverInfo(info.object ? info : null),
        onClick: (info) => info.object && setSelectedId(info.object.properties.id),
        updateTriggers: {
          getFillColor: [metricKey, isGreyed],
        },
      }),
    ];
  }, [
    boundary,
    visibleFeatures,
    radius,
    metricKey,
    isGreyed,
    datasetBounds,
    setSelectedId,
  ]);

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        mapStyle={MAP_STYLE}
        maxBounds={NY_MAX_BOUNDS}
        style={{ width: '100%', height: '100%' }}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
      {hoverInfo && <HoverPopup info={hoverInfo} />}
    </div>
  );
}
