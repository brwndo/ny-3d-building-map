import { useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import {
  activeFieldCount,
  FRESHNESS_OPTIONS,
  GREY_FIELDS,
  HIDE_FIELDS,
} from '../data/filterSchema';
import { fmtNumber } from '../data/format';
import { GOAL_PROGRAMS, mapScaleFor } from '../data/goalPrograms';

const fieldByKey = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]));
const GREY = fieldByKey(GREY_FIELDS);

const PROPERTY_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'property');
const CERT_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'cert');

export const BAND_FILTER_FIELDS = HIDE_FIELDS.filter((f) => f.key === 'band');
const LOCATION_FILTER_FIELDS = PROPERTY_FIELDS.filter((f) => f.key === 'city');
const BUILDING_FILTER_FIELDS = PROPERTY_FIELDS.filter(
  (f) => f.key === 'propertyType' || f.key === 'floorArea'
);
const CERTIFICATION_FILTER_FIELDS = CERT_FIELDS;

// Everything outside the Goal Program menu lives in the single Filters menu.
export const FILTER_HIDE_FIELDS = [
  ...BAND_FILTER_FIELDS,
  ...LOCATION_FILTER_FIELDS,
  ...BUILDING_FILTER_FIELDS,
  ...CERTIFICATION_FILTER_FIELDS,
];

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function MultiField({ field, options, selected, onChange, hint }) {
  return (
    <>
      <h3>{field.label}</h3>
      {hint && <p className="hint">{hint}</p>}
      <div className="checkbox-list">
        {options.map((opt) => (
          <label key={opt.value} className="checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onChange(toggle(selected, opt.value))}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}

function RangeField({ field, meta, value, onChange }) {
  const [min, max] = value;
  return (
    <>
      <h3>
        {field.label}: {fmtNumber(min)} – {fmtNumber(max)} {field.unit}
      </h3>
      <div className="range-group">
        <label>
          Min
          <input
            type="range"
            min={meta.min}
            max={meta.max}
            step={field.step}
            value={min}
            onChange={(e) => onChange([Math.min(Number(e.target.value), max), max])}
          />
          <input
            type="number"
            value={min}
            min={meta.min}
            max={max}
            step={field.step}
            onChange={(e) => onChange([Math.min(Number(e.target.value), max), max])}
          />
        </label>
        <label>
          Max
          <input
            type="range"
            min={meta.min}
            max={meta.max}
            step={field.step}
            value={max}
            onChange={(e) => onChange([min, Math.max(Number(e.target.value), min)])}
          />
          <input
            type="number"
            value={max}
            min={min}
            max={meta.max}
            step={field.step}
            onChange={(e) => onChange([min, Math.max(Number(e.target.value), min)])}
          />
        </label>
      </div>
    </>
  );
}

function useHideFieldRenderer() {
  const { hide, hideMeta, setHideField } = useMapState();

  return (field) =>
    field.kind === 'range' ? (
      <RangeField
        key={field.key}
        field={field}
        meta={hideMeta[field.key]}
        value={hide[field.key]}
        onChange={(v) => setHideField(field.key, v)}
      />
    ) : (
      <MultiField
        key={field.key}
        field={field}
        options={hideMeta[field.key].options}
        selected={hide[field.key]}
        onChange={(v) => setHideField(field.key, v)}
      />
    );
}

export function GoalProgramPanel() {
  const { goalProgram, setGoalProgram } = useMapState();

  return (
    <div className="filter-controls">
      <button
        type="button"
        className="goal-program-add-ai"
        onClick={() => {}}
        title="Example — not wired up yet"
      >
        <svg className="goal-program-add-ai-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 2l1.2 6.3L20 10l-6.8 1.7L12 18l-1.2-6.3L4 10l6.8-1.7L12 2z"
            fill="currentColor"
          />
        </svg>
        Add program with AI
      </button>
      <div className="goal-program-cards" role="radiogroup" aria-label="Goal program">
        {GOAL_PROGRAMS.map((program) => {
          const active = program.id === goalProgram.id;
          return (
            <button
              key={program.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`goal-program-card${active ? ' goal-program-card--active' : ''}`}
              onClick={() => setGoalProgram(program.id)}
            >
              <span className="goal-program-card-label" title={program.label}>
                {program.label}
              </span>
              <span className="goal-program-card-purpose" title={program.purpose}>
                {program.purpose}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterSection({ title, activeCount, expanded, onToggle, children }) {
  return (
    <section className="filter-section">
      <button
        type="button"
        className="filter-section-toggle"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="filter-section-chevron" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className="filter-section-title">{title}</span>
        {activeCount > 0 && <span className="filter-section-count">{activeCount}</span>}
      </button>
      {expanded && <div className="filter-section-body">{children}</div>}
    </section>
  );
}

function BandFields() {
  const { hide, hideMeta, setHideField, goalProgram } = useMapState();
  const mapScale = mapScaleFor(goalProgram);

  return (
    <>
      <p className="hint">{mapScale.legendTitle}</p>
      <div className="checkbox-list">
        {hideMeta.band.options.map((opt) => (
          <label key={opt.value} className="checkbox-row">
            <input
              type="checkbox"
              checked={hide.band.includes(opt.value)}
              onChange={() => setHideField('band', toggle(hide.band, opt.value))}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </>
  );
}

function LocationFields() {
  const { datasetBounds } = useMapState();
  const renderHide = useHideFieldRenderer();

  return (
    <>
      <h3>State</h3>
      <select value={datasetBounds.states[0]} disabled>
        {datasetBounds.states.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      {LOCATION_FILTER_FIELDS.map(renderHide)}
    </>
  );
}

function BuildingFields() {
  const renderHide = useHideFieldRenderer();
  return <>{BUILDING_FILTER_FIELDS.map(renderHide)}</>;
}

function CertificationFields() {
  const renderHide = useHideFieldRenderer();
  return <>{CERTIFICATION_FILTER_FIELDS.map(renderHide)}</>;
}

function DataConfidenceFields() {
  const { grey, greyMeta, setGreyField } = useMapState();
  const coverage = grey.coverage;

  return (
    <>
      <p className="hint">
        The active program already greys assets below its coverage floor. Extra checks here
        grey additional buildings.
      </p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={coverage.enabled}
          onChange={(e) => setGreyField('coverage', { ...coverage, enabled: e.target.checked })}
        />
        <span>{GREY.coverage.label}</span>
        <input
          type="number"
          className="pct-input"
          min="0"
          max="100"
          value={coverage.value}
          disabled={!coverage.enabled}
          onChange={(e) =>
            setGreyField('coverage', { ...coverage, value: Number(e.target.value) })
          }
        />
        <span>{GREY.coverage.unit}</span>
      </label>

      <MultiField
        field={GREY.confidenceTier}
        options={greyMeta.confidenceTier.options}
        selected={grey.confidenceTier}
        onChange={(v) => setGreyField('confidenceTier', v)}
      />

      <MultiField
        field={GREY.dataSource}
        options={greyMeta.dataSource.options}
        selected={grey.dataSource}
        onChange={(v) => setGreyField('dataSource', v)}
      />

      <h3>{GREY.lastUpdated.label}</h3>
      <select
        value={grey.lastUpdated ?? ''}
        onChange={(e) =>
          setGreyField('lastUpdated', e.target.value === '' ? null : Number(e.target.value))
        }
      >
        {FRESHNESS_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ''}>
            {opt.label}
          </option>
        ))}
      </select>
    </>
  );
}

const FILTER_SECTIONS = [
  {
    key: 'bands',
    title: 'Show only bands',
    fields: BAND_FILTER_FIELDS,
    Fields: BandFields,
  },
  {
    key: 'location',
    title: 'Location',
    fields: LOCATION_FILTER_FIELDS,
    Fields: LocationFields,
  },
  {
    key: 'building',
    title: 'Building size & type',
    fields: BUILDING_FILTER_FIELDS,
    Fields: BuildingFields,
  },
  {
    key: 'certifications',
    title: 'Certifications',
    fields: CERTIFICATION_FILTER_FIELDS,
    Fields: CertificationFields,
  },
  {
    key: 'confidence',
    title: 'Data confidence',
    effect: 'grey',
    fields: GREY_FIELDS,
    Fields: DataConfidenceFields,
  },
];

export function FiltersPanel() {
  const { hide, hideMeta, grey, greyMeta } = useMapState();

  const countFor = (section) =>
    section.effect === 'grey'
      ? activeFieldCount(section.fields, grey, greyMeta)
      : activeFieldCount(section.fields, hide, hideMeta);

  // Sections that already carry a selection start open so active filters are
  // visible without hunting; after that the user drives what stays open.
  const [expanded, setExpanded] = useState(() =>
    FILTER_SECTIONS.filter(countFor).map((s) => s.key)
  );

  const toggleSection = (key) =>
    setExpanded((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
    );

  return (
    <div className="filter-controls">
      <p className="hint">
        Options within a field match any; separate fields must all match
      </p>
      {FILTER_SECTIONS.map((section) => (
        <FilterSection
          key={section.key}
          title={section.title}
          activeCount={countFor(section)}
          expanded={expanded.includes(section.key)}
          onToggle={() => toggleSection(section.key)}
        >
          <section.Fields />
        </FilterSection>
      ))}
    </div>
  );
}
