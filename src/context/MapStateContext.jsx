import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { blockerIdsFor } from '../data/aggregateStats';
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
import {
  bandForAsset,
  belowConfidenceThreshold,
  confidenceCoveragePct,
  createProgramContext,
  getProgram,
  governedMetricKeys,
  loadProgramId,
  mapScaleFor,
  resolveProgramGoals,
  saveProgramId,
  scoreAsset,
} from '../data/goalPrograms';

function greyDefaultsForProgram(program) {
  return {
    ...defaultsFor(GREY_FIELDS),
    coverage: { enabled: true, value: confidenceCoveragePct(program) },
  };
}

const MapStateContext = createContext(null);

export function MapStateProvider({ buildings, boundary, counties, children }) {
  const [hide, setHide] = useState(() => defaultsFor(HIDE_FIELDS));
  const [grey, setGrey] = useState(() => greyDefaultsForProgram(getProgram(loadProgramId())));
  const [selectedId, setSelectedId] = useState(null);
  const [flyToRequest, setFlyToRequest] = useState(null); // {coords, ts}
  const [viewMode, setViewMode] = useState('map'); // 'map' | 'grid' | 'iso'
  const [focusAssetId, setFocusAssetId] = useState(null); // {id, ts}
  // Metric drill-down: dims every asset that isn't holding this metric back.
  // Only the key is held, so the dimmed set follows the filters instead of
  // freezing at whatever was visible when it was opened.
  const [focusMetricKey, setFocusMetricKey] = useState(null);

  // Freshness comparisons are relative to the date at load time, per spec.
  const loadedAt = useRef(new Date()).current;

  const features = buildings.features;

  const defaultPortfolioGoals = useMemo(() => derivePortfolioGoals(features), [features]);
  const [portfolioGoals, setPortfolioGoalsState] = useState(() => loadPortfolioGoals(features));
  const [programId, setProgramIdState] = useState(() => loadProgramId());

  // The active program decides what every target means, which metrics are
  // offered, and how bands are computed.
  const goalProgram = useMemo(() => getProgram(programId), [programId]);
  const programContext = useMemo(
    () => createProgramContext(features, portfolioGoals),
    [features, portfolioGoals]
  );
  const governedMetrics = useMemo(() => governedMetricKeys(goalProgram), [goalProgram]);
  const programGoals = useMemo(
    () => resolveProgramGoals(features, goalProgram, programContext),
    [features, goalProgram, programContext]
  );

  // Color asks one question of every asset under the active program's mapScale
  // (binary pass/fail, gate count, or % progress) — not a single shared ontology.
  const scoreFor = useCallback(
    (props) => scoreAsset(props, goalProgram, programContext),
    [goalProgram, programContext]
  );

  const bandFor = useCallback((props) => scoreFor(props).band, [scoreFor]);

  const metricBandFor = useCallback(
    (props, key) => bandForAsset(props, key, goalProgram, programContext),
    [goalProgram, programContext]
  );

  const setGoalProgram = useCallback((nextId) => {
    const nextProgram = getProgram(nextId);
    setProgramIdState(nextProgram.id);
    saveProgramId(nextProgram.id);
    // Blockers and band vocabulary belong to the program that named them.
    setFocusMetricKey(null);
    setHide((prev) => ({ ...prev, band: [] }));
    setGrey((prev) => ({
      ...prev,
      coverage: { enabled: true, value: confidenceCoveragePct(nextProgram) },
    }));
  }, []);

  // Option lists and range bounds, derived from the loaded dataset. Band
  // options follow the active program's mapScale.
  const hideMeta = useMemo(
    () => deriveFieldMeta(HIDE_FIELDS, features, { goalProgram }),
    [features, goalProgram]
  );
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
    const ctx = { now: loadedAt, bandFor };
    return features.filter((f) => passesVisibility(f.properties, resolvedHide, ctx));
  }, [features, resolvedHide, loadedAt, bandFor]);

  const isGreyed = useCallback(
    (props) =>
      belowConfidenceThreshold(props, goalProgram) ||
      !passesConfidence(props, resolvedGrey, { now: loadedAt }),
    [goalProgram, resolvedGrey, loadedAt]
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
    setHide(defaultsFor(HIDE_FIELDS));
    setGrey(greyDefaultsForProgram(goalProgram));
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

  const metricFocusIds = useMemo(() => {
    if (!focusMetricKey) return null;
    return new Set(
      blockerIdsFor(focusMetricKey, visibleFeatures, metricBandFor, goalProgram)
    );
  }, [focusMetricKey, visibleFeatures, metricBandFor, goalProgram]);

  const isMetricDimmed = useCallback(
    (props) => Boolean(metricFocusIds && !metricFocusIds.has(props.id)),
    [metricFocusIds]
  );

  const value = {
    buildings,
    boundary,
    counties,
    features,
    visibleFeatures,
    datasetBounds,
    loadedAt,
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
    goalProgram,
    setGoalProgram,
    governedMetrics,
    programGoals,
    programContext,
    scoreFor,
    bandFor,
    metricBandFor,
    mapScale: mapScaleFor(goalProgram),
    focusMetricKey,
    setFocusMetricKey,
    isMetricDimmed,
  };

  return <MapStateContext.Provider value={value}>{children}</MapStateContext.Provider>;
}

export function useMapState() {
  const ctx = useContext(MapStateContext);
  if (!ctx) throw new Error('useMapState must be used within MapStateProvider');
  return ctx;
}
