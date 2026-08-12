import { useEffect, useRef, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import {
  activeFieldCount,
  defaultsFor,
  GREY_FIELDS,
} from '../data/filterSchema';
import { DEFAULT_PROGRAM_ID } from '../data/goalPrograms';
import { Sparkles } from 'lucide-react';
import SearchBox from './SearchBox';
import {
  FILTER_HIDE_FIELDS,
  FiltersPanel,
  GoalProgramPanel,
} from './FilterControls';
import ReportsModal from './ReportsModal';
import AgentChatModal from './AgentChatModal';

function FilterDropdown({
  label,
  value,
  activeCount,
  open,
  onToggle,
  onReset,
  children,
  panelRef,
  panelClassName = 'controls-popover--filters',
}) {
  return (
    <div className="controls-popover-wrap" ref={panelRef}>
      <button
        type="button"
        className="controls-button"
        onClick={onToggle}
        aria-expanded={open}
      >
        {label}
        {value ? <span className="controls-button-value">{value}</span> : null}
        {activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div className={`controls-popover ${panelClassName}`}>
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
    setHideField,
    setGreyField,
    goalProgram,
    setGoalProgram,
    viewMode,
    setViewMode,
  } = useMapState();

  const [openPanel, setOpenPanel] = useState(null);
  const [openModal, setOpenModal] = useState(null);
  const searchRef = useRef(null);
  const goalProgramRef = useRef(null);
  const filtersRef = useRef(null);

  const panelRefs = {
    search: searchRef,
    goalProgram: goalProgramRef,
    filters: filtersRef,
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

  const openAppModal = (modal) => {
    setOpenPanel(null);
    setOpenModal(modal);
  };

  const filtersActiveCount =
    activeFieldCount(FILTER_HIDE_FIELDS, hide, hideMeta) +
    activeFieldCount(GREY_FIELDS, grey, greyMeta);

  const resetFields = (fields) => {
    for (const field of fields) {
      setHideField(field.key, defaultsFor([field])[field.key]);
    }
  };

  const resetGoalProgram = () => {
    setGoalProgram(DEFAULT_PROGRAM_ID);
  };

  const resetFilters = () => {
    resetFields(FILTER_HIDE_FIELDS);
    for (const field of GREY_FIELDS) {
      setGreyField(field.key, defaultsFor([field])[field.key]);
    }
  };

  return (
    <div className="map-controls">
      <div className="map-controls-left">
        <FilterDropdown
          label="Goal Program"
          value={goalProgram.label}
          open={openPanel === 'goalProgram'}
          onToggle={() => togglePanel('goalProgram')}
          onReset={resetGoalProgram}
          panelRef={goalProgramRef}
          panelClassName="controls-popover--goal-program"
        >
          <GoalProgramPanel />
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
            Pack
          </button>
          <button
            type="button"
            className={`controls-segment${viewMode === 'iso' ? ' controls-segment--active' : ''}`}
            aria-pressed={viewMode === 'iso'}
            onClick={() => setViewMode('iso')}
          >
            Iso
          </button>
        </div>
      </div>

      <div className="map-controls-status">
        <span className="controls-readout">
          Showing {visibleFeatures.length} of {features.length}
          {greyedCount > 0 && ` · ${greyedCount} greyed`}
        </span>
      </div>

      <div className="map-controls-right">
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
            <div className="controls-popover controls-popover--search controls-popover--end">
              <SearchBox autoFocus onSelect={() => setOpenPanel(null)} />
            </div>
          )}
        </div>

        <FilterDropdown
          label="Filters"
          activeCount={filtersActiveCount}
          open={openPanel === 'filters'}
          onToggle={() => togglePanel('filters')}
          onReset={resetFilters}
          panelRef={filtersRef}
          panelClassName="controls-popover--filters controls-popover--end"
        >
          <FiltersPanel />
        </FilterDropdown>

        <button
          type="button"
          className="controls-button"
          onClick={() => openAppModal('reports')}
          aria-haspopup="dialog"
          aria-expanded={openModal === 'reports'}
        >
          Report
        </button>

        <span className="controls-ai-split" aria-hidden="true" />

        <button
          type="button"
          className="agent-chat-button"
          onClick={() => openAppModal('chat')}
          aria-haspopup="dialog"
          aria-expanded={openModal === 'chat'}
          aria-label="Open AI agent chat"
          title="Ask the agent"
        >
          <Sparkles aria-hidden="true" />
        </button>
      </div>

      <ReportsModal open={openModal === 'reports'} onClose={() => setOpenModal(null)} />
      <AgentChatModal open={openModal === 'chat'} onClose={() => setOpenModal(null)} />
    </div>
  );
}
