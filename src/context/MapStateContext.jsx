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
import {
  derivePortfolioGoals,
  loadPortfolioGoals,
  patchPortfolioGoal,
  savePortfolioGoals,
} from '../data/portfolioGoals';

const MapStateContext = createContext(null);

export function MapStateProvider({ buildings, boundary, counties, children }) {
  const [metricKey, setMetricKey] = useState(DEFAULT_METRIC);
  const [hide, setHide] = useState(() => defaultsFor(HIDE_FIELDS));
  const [grey, setGrey] = useState(() => defaultsFor(GREY_FIELDS));
  const [selectedId, setSelectedId] = useState(null);
  const [flyToRequest, setFlyToRequest] = useState(null); // {coords, ts}
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'grid'
  const [focusAssetId, setFocusAssetId] = useState(null); // {id, ts}

  // Freshness comparisons are relative to the date at load time, per spec.
  const loadedAt = useRef(new Date()).current;

  const features = buildings.features;

  const defaultPortfolioGoals = useMemo(() => derivePortfolioGoals(features), [features]);
  const [portfolioGoals, setPortfolioGoalsState] = useState(() => loadPortfolioGoals(features));

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

  const setPortfolioGoal = useCallback((metricKeyToPatch, patch) => {
    setPortfolioGoalsState((prev) => {
      const next = patchPortfolioGoal(prev, metricKeyToPatch, patch);
      savePortfolioGoals(next);
      return next;
    });
  }, []);

  const setPortfolioGoals = useCallback((nextGoals) => {
    setPortfolioGoalsState(nextGoals);
    savePortfolioGoals(nextGoals);
  }, []);

  const resetPortfolioGoals = useCallback(() => {
    const next = derivePortfolioGoals(features);
    setPortfolioGoalsState(next);
    savePortfolioGoals(next);
  }, [features]);

  const value = {
    buildings,
    boundary,
    counties,
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
    viewMode,
    setViewMode,
    focusAssetId,
    setFocusAssetId,
    resetFilters,
    portfolioGoals,
    defaultPortfolioGoals,
    setPortfolioGoal,
    setPortfolioGoals,
    resetPortfolioGoals,
  };

  return <MapStateContext.Provider value={value}>{children}</MapStateContext.Provider>;
}

export function useMapState() {
  const ctx = useContext(MapStateContext);
  if (!ctx) throw new Error('useMapState must be used within MapStateProvider');
  return ctx;
}
