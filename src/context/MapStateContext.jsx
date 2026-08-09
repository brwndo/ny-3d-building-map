import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { DEFAULT_METRIC } from '../data/colorScale';
import { passesConfidence, passesVisibility } from '../data/filters';
import {
  GREY_FIELDS,
  HIDE_FIELDS,
  defaultsFor,
  deriveFieldMeta,
  activeFieldCount,
  resolveState,
} from '../data/filterSchema';

const MapStateContext = createContext(null);

export function MapStateProvider({ buildings, boundary, children }) {
  const [metricKey, setMetricKey] = useState(DEFAULT_METRIC);
  const [hide, setHide] = useState(() => defaultsFor(HIDE_FIELDS));
  const [grey, setGrey] = useState(() => defaultsFor(GREY_FIELDS));
  const [selectedId, setSelectedId] = useState(null);
  const [flyToRequest, setFlyToRequest] = useState(null); // {coords, ts}

  // Freshness comparisons are relative to the date at load time, per spec.
  const loadedAt = useRef(new Date()).current;

  const features = buildings.features;

  // Option lists and range bounds, derived from the loaded dataset.
  const hideMeta = useMemo(() => deriveFieldMeta(HIDE_FIELDS, features), [features]);
  const greyMeta = useMemo(() => deriveFieldMeta(GREY_FIELDS, features), [features]);

  // Column height and the (read-only) State select need dataset facts that
  // aren't filter fields.
  const datasetBounds = useMemo(() => {
    const floors = features.map((f) => f.properties.floors);
    return {
      minFloors: Math.min(...floors),
      maxFloors: Math.max(...floors),
      states: [...new Set(features.map((f) => f.properties.state))].sort(),
    };
  }, [features]);

  const setHideField = useCallback(
    (key, value) => setHide((prev) => ({ ...prev, [key]: value })),
    []
  );
  const setGreyField = useCallback(
    (key, value) => setGrey((prev) => ({ ...prev, [key]: value })),
    []
  );

  const resolvedHide = useMemo(
    () => resolveState(HIDE_FIELDS, hide, hideMeta),
    [hide, hideMeta]
  );
  const resolvedGrey = useMemo(
    () => resolveState(GREY_FIELDS, grey, greyMeta),
    [grey, greyMeta]
  );

  const visibleFeatures = useMemo(() => {
    const ctx = { metricKey, now: loadedAt };
    return features.filter((f) => passesVisibility(f.properties, resolvedHide, ctx));
  }, [features, resolvedHide, metricKey, loadedAt]);

  const isGreyed = useCallback(
    (props) => !passesConfidence(props, resolvedGrey, { metricKey, now: loadedAt }),
    [resolvedGrey, metricKey, loadedAt]
  );

  const greyedCount = useMemo(
    () => visibleFeatures.filter((f) => isGreyed(f.properties)).length,
    [visibleFeatures, isGreyed]
  );

  const activeHideCount = activeFieldCount(HIDE_FIELDS, resolvedHide, hideMeta);

  const selectedFeature = useMemo(
    () => features.find((f) => f.properties.id === selectedId) ?? null,
    [features, selectedId]
  );

  const resetFilters = () => {
    setMetricKey(DEFAULT_METRIC);
    setHide(defaultsFor(HIDE_FIELDS));
    setGrey(defaultsFor(GREY_FIELDS));
  };

  const value = {
    buildings,
    boundary,
    features,
    visibleFeatures,
    datasetBounds,
    loadedAt,
    metricKey,
    setMetricKey,
    hide: resolvedHide,
    hideMeta,
    setHideField,
    grey: resolvedGrey,
    greyMeta,
    setGreyField,
    isGreyed,
    greyedCount,
    activeHideCount,
    selectedId,
    setSelectedId,
    selectedFeature,
    flyToRequest,
    setFlyToRequest,
    resetFilters,
  };

  return <MapStateContext.Provider value={value}>{children}</MapStateContext.Provider>;
}

export function useMapState() {
  const ctx = useContext(MapStateContext);
  if (!ctx) throw new Error('useMapState must be used within MapStateProvider');
  return ctx;
}
