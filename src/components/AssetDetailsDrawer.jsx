import { useEffect, useRef } from 'react';
import { useMapState } from '../context/MapStateContext';
import { METRICS, bandCss } from '../data/colorScale';
import { fmtDate, fmtMetricValue, fmtMoney, fmtNumber, fmtPct } from '../data/format';
import { formatLeedLabel } from '../data/certs';
import { isDerivedMetric, resolveAssetMetric } from '../data/derivedMetrics';
import {
  describeAssetMetric,
  formatCompletion,
  formatTargetsMet,
  governsMetric,
} from '../data/goalPrograms';

const COMPLIANCE_CHIP = {
  Compliant: 'Target Met',
  'At Risk': 'At Risk',
  'Non-Compliant': 'Off Track',
};

function Chip({ label, band }) {
  return (
    <span className="chip" style={{ background: bandCss(band) }}>
      {label}
    </span>
  );
}

function eligibilityText({ energyStarScore, twelveMonthDataComplete, energyStarEligible }) {
  if (energyStarEligible) return 'Yes';
  const blockers = [];
  if (energyStarScore < 75) blockers.push('score below 75');
  if (!twelveMonthDataComplete) blockers.push('12-month data incomplete');
  return `No — ${blockers.join(' and ')}`;
}

function Row({ label, children }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{children}</span>
    </div>
  );
}

function MetricCard({ label, metric, described }) {
  const targetRowLabel = described.targetYear
    ? `${described.targetLabel} (${described.targetYear})`
    : described.targetLabel;

  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <span className="metric-name">{label}</span>
        <Chip label={described.band ?? 'Not covered'} band={described.band} />
      </div>
      <div className="metric-card-body">
        <Row label="Current">{fmtMetricValue(metric.currentValue, metric.unit)}</Row>
        {described.covered ? (
          <Row label={targetRowLabel}>
            {fmtMetricValue(described.targetValue, metric.unit)}
          </Row>
        ) : (
          <Row label="Target">{described.targetLabel}</Row>
        )}
        {described.p != null && (
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${described.p * 100}%`, background: bandCss(described.band) }}
            />
          </div>
        )}
        {!described.governed && (
          <p className="hint">Not governed by the active goal program</p>
        )}
      </div>
    </div>
  );
}

export default function AssetDetailsDrawer() {
  const { selectedFeature, selectedId, setSelectedId, goalProgram, programContext, scoreFor } =
    useMapState();
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!selectedFeature) return;
    const onEsc = (e) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [selectedFeature, setSelectedId]);

  // Send the keyboard into the drawer when it opens and hand it back to
  // whatever opened it on close, so Esc/Tab act on the dialog rather than the
  // map underneath.
  useEffect(() => {
    if (selectedId == null) return;
    const opener = document.activeElement;
    drawerRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [selectedId]);

  if (!selectedFeature) return null;

  const p = selectedFeature.properties;
  const c = p.compliance;
  const score = scoreFor(p);

  return (
    <div className="asset-details-overlay" onClick={() => setSelectedId(null)}>
      <aside
        ref={drawerRef}
        className="asset-details-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-details-title"
        tabIndex={-1}
      >
        <div className="drawer-controls">
          <div className="drawer-controls-info">
            <h2 id="asset-details-title">{p.name}</h2>
            <div className="detail-sub">
              {p.id} · {p.address}, {p.city}, {p.state} {p.zip}
            </div>
            <div className="detail-sub">
              {p.propertyType} · {p.floors} {p.floors === 1 ? 'floor' : 'floors'} ·{' '}
              {fmtNumber(p.floorArea)} sq ft
            </div>
          </div>
          <button className="close-button" onClick={() => setSelectedId(null)} aria-label="Close">
            ×
          </button>
        </div>

        {/* Focusable so the dense, scrollable body is reachable by keyboard. */}
        <div className="drawer-body" tabIndex={0}>
          <div className="drawer-stat-block">
            <div className="drawer-block-head">
              <h3>Performance vs {goalProgram.label}</h3>
              <Chip label={formatCompletion(score, goalProgram)} band={score.band} />
            </div>
            {score.covered && <p className="hint">{formatTargetsMet(score, goalProgram)}</p>}
            <p className="hint">{goalProgram.purpose}</p>
            {/* A derived predicate only means something while a program grades
                it, so it stays out of the drawer the rest of the time. */}
            {METRICS.filter(
              (m) => !isDerivedMetric(m.key) || governsMetric(goalProgram, m.key)
            ).map((m) => (
              <MetricCard
                key={m.key}
                label={m.label}
                metric={resolveAssetMetric(p, m.key)}
                described={describeAssetMetric(p, m.key, goalProgram, programContext)}
              />
            ))}
          </div>

          <div className="drawer-stat-block">
            <h3>Other Reported Values</h3>
            <p className="hint">No baseline tracked — raw values only</p>
            <Row label="GH1 Scope 2 (market-based)">{fmtNumber(p.raw.scope2Market)} mtCO2e</Row>
            <Row label="GH1 Scope 3 (unscored)">{fmtNumber(p.raw.scope3)} mtCO2e</Row>
            <Row label="EN1 Generated on-site">{fmtNumber(p.raw.en1Generated)} kWh</Row>
            <Row label="EN1 Exported">{fmtNumber(p.raw.en1Exported)} kWh</Row>
            <Row label="WT2 Discharge to sensitive waterways">{fmtNumber(p.raw.wt2)} gal</Row>

            <h3>Certifications</h3>
            <Row label="BC1.1 Design/Construction">
              {p.cert.bc11 ? formatLeedLabel(p.cert.bc11) : 'None'}
            </Row>
            <Row label="BC1.2 Operational">
              {p.cert.bc12 ? formatLeedLabel(p.cert.bc12) : 'None'}
            </Row>
            <Row label="BC2 Ongoing">{p.cert.bc2 ?? 'None'}</Row>
            <Row label="ENERGY STAR score">{p.energyStarScore}</Row>
            <Row label="12-month whole-building data">
              {p.twelveMonthDataComplete ? 'Complete' : 'Incomplete'}
            </Row>
            <Row label="Certification eligible">{eligibilityText(p)}</Row>
          </div>

          <div className="drawer-stat-block">
            <h3>Data Confidence</h3>
            <Row label="Data coverage">{fmtPct(p.dataCoverage)}</Row>
            <Row label="Confidence tier">{p.confidenceTier}</Row>
            <Row label="Data source">{p.dataSource}</Row>
            <Row label="Last updated">{fmtDate(p.lastUpdated)}</Row>
          </div>

          <div className="drawer-stat-block">
            <h3>Compliance Exposure (LL97)</h3>
            <Row label="LL97 applicable">{c.ll97Applicable}</Row>
            <Row label="Current emissions (Scope 1+2)">{fmtNumber(c.currentEmissions)} mtCO2e</Row>

            <h4>2024–2029 period</h4>
            <Row label="Emissions limit">{fmtNumber(c.limit2024)} mtCO2e</Row>
            <Row label="Over/(Under) cap">{fmtNumber(c.overCap2024)} mtCO2e</Row>
            <Row label="Estimated fine exposure">{fmtMoney(c.fine2024)}</Row>
            <Row label="Status">
              <Chip label={c.status2024} band={COMPLIANCE_CHIP[c.status2024]} />
            </Row>

            <h4>2030–2034 period (projected)</h4>
            <Row label="Emissions limit">{fmtNumber(c.limit2030)} mtCO2e</Row>
            <Row label="Projected over/(Under) cap">{fmtNumber(c.overCap2030)} mtCO2e</Row>
            <Row label="Projected fine exposure">{fmtMoney(c.fine2030)}</Row>
            <Row label="Status">
              <Chip label={c.status2030} band={COMPLIANCE_CHIP[c.status2030]} />
            </Row>

            <h4>LL84 filing</h4>
            <Row label="Filing status">{c.ll84FilingStatus}</Row>
            <Row label="Next filing deadline">{fmtDate(c.ll84NextDeadline)}</Row>
            <Row label="Days to deadline">{c.daysToDeadline}</Row>
            <Row label="Non-filing penalty">{fmtMoney(c.nonFilingPenaltyRate)}/month</Row>
            <Row label="Other NYC local laws">{c.otherLaws}</Row>
          </div>
        </div>
      </aside>
    </div>
  );
}
