import { useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { METRICS } from '../data/colorScale';
import {
  activeFieldCount,
  FRESHNESS_OPTIONS,
  GREY_FIELDS,
  HIDE_FIELDS,
} from '../data/filterSchema';
import { fmtNumber } from '../data/format';
import { GOAL_PROGRAMS } from '../data/goalPrograms';

const fieldByKey = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]));
const HIDE = fieldByKey(HIDE_FIELDS);
const GREY = fieldByKey(GREY_FIELDS);

const PROPERTY_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'property');
const CERT_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'cert');

export const GOAL_PROGRAM_FILTER_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'performance');
const LOCATION_FILTER_FIELDS = PROPERTY_FIELDS.filter((f) => f.key === 'city');
const BUILDING_FILTER_FIELDS = PROPERTY_FIELDS.filter(
  (f) => f.key === 'propertyType' || f.key === 'floorArea'
);
const CERTIFICATION_FILTER_FIELDS = CERT_FIELDS;

// Everything outside the Goal Program dropdown lives in the single Filters menu.
export const FILTER_HIDE_FIELDS = [
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
  const { governedMetrics, goalProgram, setGoalProgram, hide, hideMeta, setHideField } =
    useMapState();

  const targets = METRICS.filter((m) => governedMetrics.includes(m.key));

  return (
    <div className="filter-controls">
      <p className="hint">Sets what every target means and drives building color</p>
      <select value={goalProgram.id} onChange={(e) => setGoalProgram(e.target.value)}>
        {GOAL_PROGRAMS.map((program) => (
          <option key={program.id} value={program.id}>
            {program.label}
          </option>
        ))}
      </select>
      <p className="program-purpose">{goalProgram.purpose}</p>
      <p className="program-authority">Authority: {goalProgram.authority}</p>

      <h3>Color</h3>
      <p className="hint">
        How close each asset is to{' '}
        {targets.length === 1 ? 'this target' : `all ${targets.length} of these targets`}
      </p>
      <ul className="program-target-list">
        {targets.map((m) => (
          <li key={m.key}>{m.label}</li>
        ))}
      </ul>

      <MultiField
        field={HIDE.band}
        options={hideMeta.band.options}
        selected={hide.band}
        onChange={(v) => setHideField('band', v)}
        hint="Progress against the active program"
      />
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
      <p className="hint">Failing any active check renders the building grey</p>
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
