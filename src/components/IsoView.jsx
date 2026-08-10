import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { OrbitView } from '@deck.gl/core';

import { useMapState } from '../context/MapStateContext';
import {
  buildFloorGridPaths,
  fitZoomForExtent,
  layoutIsoFeatures,
} from '../data/isoLayout';
import {
  createFloorGridLayer,
  createIsoClusterLabelsLayer,
  createIsoColumnsLayer,
  createIsoSelectionLayer,
  isoLightingEffect,
} from '../data/isoLayers';
import HoverPopup from './HoverPopup';
import MapNavigation from './MapNavigation';

const ISO_VIEW = new OrbitView({
  id: 'iso',
  orthographic: true,
  controller: {
    dragRotate: false,
    touchRotate: false,
    keyboard: false,
  },
});

const DEFAULT_ROTATION_X = 32;
const DEFAULT_ROTATION_ORBIT = 45;

function initialViewState(center, zoom) {
  return {
    target: center,
    zoom,
    rotationX: DEFAULT_ROTATION_X,
    rotationOrbit: DEFAULT_ROTATION_ORBIT,
    minZoom: -2,
    maxZoom: 6,
    minRotationX: DEFAULT_ROTATION_X,
    maxRotationX: DEFAULT_ROTATION_X,
  };
}

export default function IsoView() {
  const {
    visibleFeatures,
    bandFor,
    isGreyed,
    isMetricDimmed,
    selectedId,
    setSelectedId,
    datasetBounds,
    focusAssetId,
  } = useMapState();

  const containerRef = useRef(null);
  const sizeRef = useRef({ width: 800, height: 600 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoverInfo, setHoverInfo] = useState(null);
  const [viewState, setViewState] = useState(() =>
    initialViewState([0, 0, 0], 1)
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      };
      sizeRef.current = next;
      setSize(next);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(() => layoutIsoFeatures(visibleFeatures), [visibleFeatures]);

  const layoutKey = useMemo(
    () => visibleFeatures.map((f) => f.properties.id).join('|'),
    [visibleFeatures]
  );

  const gridPaths = useMemo(
    () => buildFloorGridPaths(layout.extent),
    [layout.extent]
  );

  const fitToLayout = useCallback(() => {
    const { width, height } = sizeRef.current;
    const zoom = fitZoomForExtent(layout.extent, width, height);
    setViewState(initialViewState(layout.center, zoom));
  }, [layout]);

  // Refit when filters change the packed set.
  useEffect(() => {
    fitToLayout();
  }, [layoutKey, fitToLayout]);

  // Correct the initial placeholder size once the canvas is measured.
  const hasMeasured = useRef(false);
  useEffect(() => {
    if (hasMeasured.current) return;
    if (size.width < 50 || size.height < 50) return;
    hasMeasured.current = true;
    fitToLayout();
  }, [size.width, size.height, fitToLayout]);

  // Search / focus: pan toward the focused asset cell.
  useEffect(() => {
    if (!focusAssetId?.id) return;
    const pos = layout.byId.get(focusAssetId.id);
    if (!pos) return;
    setViewState((prev) => ({
      ...prev,
      target: [pos.x, pos.y, 0],
      zoom: Math.max(prev.zoom, 1.8),
      transitionDuration: 600,
    }));
  }, [focusAssetId, layout.byId]);

  const selectedCell = useMemo(() => {
    if (!selectedId) return null;
    return layout.cells.find((c) => c.id === selectedId) ?? null;
  }, [layout.cells, selectedId]);

  const layers = useMemo(() => {
    const stack = [createFloorGridLayer(gridPaths)];

    stack.push(
      createIsoColumnsLayer(layout.cells, {
        bandFor,
        isGreyed,
        isMetricDimmed,
        minFloors: datasetBounds.minFloors,
        maxFloors: datasetBounds.maxFloors,
        onHover: (info) => {
          if (!info.object) {
            setHoverInfo(null);
            return;
          }
          setHoverInfo({
            x: info.x,
            y: info.y,
            object: info.object.feature,
          });
        },
        onClick: (info) => {
          if (info.object) setSelectedId(info.object.feature.properties.id);
        },
      })
    );

    const highlight = createIsoSelectionLayer(
      selectedCell,
      datasetBounds.minFloors,
      datasetBounds.maxFloors
    );
    if (highlight) stack.push(...highlight);

    const labels = createIsoClusterLabelsLayer(layout.groups);
    if (labels) stack.push(labels);

    return stack;
  }, [
    gridPaths,
    layout.cells,
    layout.groups,
    bandFor,
    isGreyed,
    isMetricDimmed,
    datasetBounds.minFloors,
    datasetBounds.maxFloors,
    selectedCell,
    setSelectedId,
  ]);

  const resetView = useCallback(() => {
    fitToLayout();
  }, [fitToLayout]);

  const zoomIn = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min((prev.zoom ?? 0) + 0.5, prev.maxZoom ?? 6),
      transitionDuration: 200,
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max((prev.zoom ?? 0) - 0.5, prev.minZoom ?? -2),
      transitionDuration: 200,
    }));
  }, []);

  return (
    <div className="iso-view" ref={containerRef}>
      <DeckGL
        views={ISO_VIEW}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next)}
        controller
        layers={layers}
        effects={[isoLightingEffect]}
        style={{ background: '#f7f6f3' }}
        getCursor={({ isDragging, isHovering }) =>
          isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'
        }
      />
      {hoverInfo && <HoverPopup info={hoverInfo} />}
      <MapNavigation
        bearing={viewState.rotationOrbit ?? DEFAULT_ROTATION_ORBIT}
        onResetNorth={resetView}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
      />
    </div>
  );
}
