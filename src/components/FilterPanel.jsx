import { useMapState } from '../context/MapStateContext';
import { METRICS } from '../data/colorScale';
import { FRESHNESS_OPTIONS, GREY_FIELDS, HIDE_FIELDS } from '../data/filterSchema';
import { fmtNumber } from '../data/format';

const fieldByKey = (fields) => Object.fromEntries(fields.map((f) => [f.key, f]));
const HIDE = fieldByKey(HIDE_FIELDS);
const GREY = fieldByKey(GREY_FIELDS);

const PROPERTY_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'property');
const CERT_FIELDS = HIDE_FIELDS.filter((f) => f.group === 'cert');

const EFFECT_LABEL = {
  hides: 'hides',
  colors: 'colors',
  greys: 'greys',
};

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function EffectBadge({ effect }) {
  return <span className={`effect-badge effect-${effect}`}>{EFFECT_LABEL[effect]}</span>;
}

function MultiField({ field, options, selected, onChange, badge, hint }) {
  return (
    <>
      <h3>
        {field.label} {badge && <EffectBadge effect={badge} />}
      </h3>
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

export default function FilterPanel() {
  const {
    features,
    visibleFeatures,
    greyedCount,
    activeHideCount,
    datasetBounds,
    metricKey,
    setMetricKey,
    hide,
    hideMeta,
    setHideField,
    grey,
    greyMeta,
    setGreyField,
    resetFilters,
  } = useMapState();

  const renderHide = (field) =>
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

  const coverage = grey.coverage;

  return (
    <aside className="filter-panel">
      <div className="panel-header">
        <h1>NY Portfolio Map</h1>
        <button className="link-button" onClick={resetFilters}>
          Reset
        </button>
      </div>

      <div className="results-readout">
        <strong>
          Showing {visibleFeatures.length} of {features.length}
        </strong>
        {greyedCount > 0 && <span> · {greyedCount} greyed</span>}
        {activeHideCount > 0 && (
          <span className="readout-sub">
            {activeHideCount} {activeHideCount === 1 ? 'filter' : 'filters'} active
          </span>
        )}
      </div>

      <section>
        <h2>
          Performance Metric <EffectBadge effect="colors" />
        </h2>
        <p className="hint">Drives building color</p>
        <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
          {METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>

        <MultiField
          field={HIDE.band}
          options={hideMeta.band.options}
          selected={hide.band}
          onChange={(v) => setHideField('band', v)}
          badge="hides"
          hint="Applies to the metric selected above"
        />
      </section>

      <section>
        <h2>
          Portfolio Filters <EffectBadge effect="hides" />
        </h2>
        <p className="hint">
          Options within a field match any; separate fields must all match
        </p>

        <div className="filter-subgroup">
          <h3 className="subgroup-title">Property Details</h3>
          {PROPERTY_FIELDS.map(renderHide)}

          <h3>State</h3>
          <select value={datasetBounds.states[0]} disabled>
            {datasetBounds.states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="filter-subgroup">
          <h3 className="subgroup-title">Certifications</h3>
          {CERT_FIELDS.map(renderHide)}
        </div>
      </section>

      <section>
        <h2>
          Data Confidence <EffectBadge effect="greys" />
        </h2>
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
      </section>
    </aside>
  );
}
