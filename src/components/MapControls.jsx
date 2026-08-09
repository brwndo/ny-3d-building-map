import { useEffect, useRef, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { DEFAULT_METRIC } from '../data/colorScale';
import {
  activeFieldCount,
  defaultsFor,
  GREY_FIELDS,
} from '../data/filterSchema';
import SearchBox from './SearchBox';
import {
  BUILDING_FILTER_FIELDS,
  BuildingFilterPanel,
  CERTIFICATION_FILTER_FIELDS,
  CertificationsFilterPanel,
  DataConfidenceFilterPanel,
  LOCATION_FILTER_FIELDS,
  LocationFilterPanel,
  PERFORMANCE_FILTER_FIELDS,
  PerformanceFilterPanel,
} from './FilterControls';

function FilterDropdown({ label, activeCount, open, onToggle, onReset, children, panelRef }) {
  return (
    <div className="controls-popover-wrap" ref={panelRef}>
      <button
        type="button"
        className="controls-button"
        onClick={onToggle}
        aria-expanded={open}
      >
        {label}
        {activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className="controls-popover controls-popover--filters">
          <div className="controls-popover-header">
            <strong>{label}</strong>
            <button type="button" className="link-button" onClick={onReset}>
              Reset
            </button>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}

export default function MapControls() {
  const {
    features,
    visibleFeatures,
    greyedCount,
    hide,
    hideMeta,
    grey,
    greyMeta,
    setMetricKey,
    setHideField,
    setGreyField,
    viewMode,
    setViewMode,
  } = useMapState();

  const [openPanel, setOpenPanel] = useState(null);
  const searchRef = useRef(null);
  const performanceRef = useRef(null);
  const locationRef = useRef(null);
  const buildingRef = useRef(null);
  const certificationsRef = useRef(null);
  const confidenceRef = useRef(null);

  const panelRefs = {
    search: searchRef,
    performance: performanceRef,
    location: locationRef,
    building: buildingRef,
    certifications: certificationsRef,
    confidence: confidenceRef,
  };

  useEffect(() => {
    if (!openPanel) return undefined;
    const ref = panelRefs[openPanel];
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpenPanel(null);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpenPanel(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [openPanel]);

  const togglePanel = (panel) => {
    setOpenPanel((current) => (current === panel ? null : panel));
  };

  const performanceActiveCount = activeFieldCount(PERFORMANCE_FILTER_FIELDS, hide, hideMeta);
  const locationActiveCount = activeFieldCount(LOCATION_FILTER_FIELDS, hide, hideMeta);
  const buildingActiveCount = activeFieldCount(BUILDING_FILTER_FIELDS, hide, hideMeta);
  const certificationsActiveCount = activeFieldCount(
    CERTIFICATION_FILTER_FIELDS,
    hide,
    hideMeta
  );
  const confidenceActiveCount = activeFieldCount(GREY_FIELDS, grey, greyMeta);

  const resetFields = (fields) => {
    for (const field of fields) {
      setHideField(field.key, defaultsFor([field])[field.key]);
    }
  };

  const resetPerformance = () => {
    setMetricKey(DEFAULT_METRIC);
    resetFields(PERFORMANCE_FILTER_FIELDS);
  };

  const resetLocation = () => resetFields(LOCATION_FILTER_FIELDS);
  const resetBuilding = () => resetFields(BUILDING_FILTER_FIELDS);
  const resetCertifications = () => resetFields(CERTIFICATION_FILTER_FIELDS);

  const resetConfidence = () => {
    for (const field of GREY_FIELDS) {
      setGreyField(field.key, defaultsFor([field])[field.key]);
    }
  };

  return (
    <div className="map-controls">
      <div className="map-controls-left">
        <div className="controls-popover-wrap" ref={searchRef}>
          <button
            type="button"
            className="controls-button"
            onClick={() => togglePanel('search')}
            aria-expanded={openPanel === 'search'}
          >
            Search
          </button>
          {openPanel === 'search' && (
            <div className="controls-popover controls-popover--search">
              <SearchBox autoFocus onSelect={() => setOpenPanel(null)} />
            </div>
          )}
        </div>

        <FilterDropdown
          label="Performance"
          activeCount={performanceActiveCount}
          open={openPanel === 'performance'}
          onToggle={() => togglePanel('performance')}
          onReset={resetPerformance}
          panelRef={performanceRef}
        >
          <PerformanceFilterPanel />
        </FilterDropdown>

        <FilterDropdown
          label="Location"
          activeCount={locationActiveCount}
          open={openPanel === 'location'}
          onToggle={() => togglePanel('location')}
          onReset={resetLocation}
          panelRef={locationRef}
        >
          <LocationFilterPanel />
        </FilterDropdown>

        <FilterDropdown
          label="Building Size & Type"
          activeCount={buildingActiveCount}
          open={openPanel === 'building'}
          onToggle={() => togglePanel('building')}
          onReset={resetBuilding}
          panelRef={buildingRef}
        >
          <BuildingFilterPanel />
        </FilterDropdown>

        <FilterDropdown
          label="Certifications"
          activeCount={certificationsActiveCount}
          open={openPanel === 'certifications'}
          onToggle={() => togglePanel('certifications')}
          onReset={resetCertifications}
          panelRef={certificationsRef}
        >
          <CertificationsFilterPanel />
        </FilterDropdown>

        <FilterDropdown
          label="Confidence"
          activeCount={confidenceActiveCount}
          open={openPanel === 'confidence'}
          onToggle={() => togglePanel('confidence')}
          onReset={resetConfidence}
          panelRef={confidenceRef}
        >
          <DataConfidenceFilterPanel />
        </FilterDropdown>

        <div className="view-mode-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={`controls-segment${viewMode === 'map' ? ' controls-segment--active' : ''}`}
            aria-pressed={viewMode === 'map'}
            onClick={() => setViewMode('map')}
          >
            Map
          </button>
          <button
            type="button"
            className={`controls-segment${viewMode === 'grid' ? ' controls-segment--active' : ''}`}
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
          >
            Grid
          </button>
        </div>
      </div>
      <div className="map-controls-status">
        <span className="controls-readout">
          Showing {visibleFeatures.length} of {features.length}
          {greyedCount > 0 && ` · ${greyedCount} greyed`}
        </span>
      </div>
    </div>
  );
}
