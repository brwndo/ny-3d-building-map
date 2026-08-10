import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, useControl } from 'react-map-gl/maplibre';
import { MapboxOverlay } from '@deck.gl/mapbox';
import 'maplibre-gl/dist/maplibre-gl.css';

import { useMapState } from '../context/MapStateContext';
import { enhanceBasemap } from '../data/enhanceBasemapStyle';
import {
  createAssetDotsLayer,
  createBoundaryLayer,
  createCountyBoundariesLayer,
  createCountyLabelsLayer,
  createOutsideMaskLayer,
  createSelectedHighlightLayer,
} from '../data/mapLayers';
import HoverPopup from './HoverPopup';
import MapNavigation from './MapNavigation';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const REGIONAL_MAX_BOUNDS = [
  [-85.0, 38.0],
  [-65.0, 47.0],
];
const INITIAL_VIEW = { longitude: -75.0, latitude: 42.4, zoom: 6.3, pitch: 0, bearing: 0 };

function DeckGLOverlay(props) {
  const overlay = useControl(() => new MapboxOverlay({ ...props, interleaved: false }));
  overlay.setProps(props);
  return null;
}

export default function MapView() {
  const {
    boundary,
    counties,
    visibleFeatures,
    bandFor,
    isGreyed,
    isMetricDimmed,
    selectedFeature,
    setSelectedId,
    flyToRequest,
  } = useMapState();

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW);
  const [hoverInfo, setHoverInfo] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (flyToRequest && mapRef.current) {
      mapRef.current.flyTo({
        center: flyToRequest.coords,
        zoom: 13,
        pitch: 0,
        duration: 1400,
      });
    }
  }, [flyToRequest]);

  const resetNorth = () => {
    if (mapRef.current) {
      mapRef.current.easeTo({ bearing: 0, duration: 300 });
      return;
    }
    setViewState((prev) => ({ ...prev, bearing: 0 }));
  };

  const zoomIn = () => {
    mapRef.current?.zoomIn({ duration: 200 });
  };

  const zoomOut = () => {
    mapRef.current?.zoomOut({ duration: 200 });
  };

  const handleMapLoad = (evt) => {
    const map = evt.target;
    enhanceBasemap(map);
    // Some style layers resolve after first paint; one idle pass keeps zoom consistent.
    map.once('idle', () => enhanceBasemap(map));
  };

  const layers = useMemo(() => {
    const stack = [];

    const mask = createOutsideMaskLayer(boundary);
    if (mask) stack.push(mask);

    const countyLines = createCountyBoundariesLayer(counties, viewState.zoom);
    if (countyLines) stack.push(countyLines);

    const countyLabels = createCountyLabelsLayer(counties, viewState.zoom);
    if (countyLabels) stack.push(countyLabels);

    stack.push(createBoundaryLayer(boundary));
    stack.push(
      createAssetDotsLayer(visibleFeatures, {
        bandFor,
        isGreyed,
        isMetricDimmed,
        onHover: (info) => setHoverInfo(info.object ? info : null),
        onClick: (info) => info.object && setSelectedId(info.object.properties.id),
      })
    );

    const highlight = createSelectedHighlightLayer(selectedFeature, visibleFeatures);
    if (highlight) stack.push(highlight);

    return stack;
  }, [
    boundary,
    counties,
    visibleFeatures,
    bandFor,
    isGreyed,
    isMetricDimmed,
    selectedFeature,
    viewState.zoom,
    setSelectedId,
  ]);

  return (
    <div className="map-container" ref={containerRef}>
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={handleMapLoad}
        mapStyle={MAP_STYLE}
        maxBounds={REGIONAL_MAX_BOUNDS}
        maxPitch={0}
        style={{ width: '100%', height: '100%' }}
      >
        <DeckGLOverlay layers={layers} />
      </Map>
      {hoverInfo && <HoverPopup info={hoverInfo} />}
      <MapNavigation
        bearing={viewState.bearing ?? 0}
        onResetNorth={resetNorth}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />
    </div>
  );
}
