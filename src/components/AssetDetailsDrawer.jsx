import { useEffect } from 'react';
import { useMapState } from '../context/MapStateContext';
import { METRICS, bandCss } from '../data/colorScale';
import { fmtDate, fmtMetricValue, fmtMoney, fmtNumber, fmtPct } from '../data/format';

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

function MetricCard({ label, metric }) {
  return (
    <div className="metric-card">
      <div className="metric-card-header">
        <span className="metric-name">{label}</span>
        <Chip label={metric.band} band={metric.band} />
      </div>
      <div className="metric-card-body">
        <Row label="Current">{fmtMetricValue(metric.currentValue, metric.unit)}</Row>
        <Row label={`Target (${metric.targetYear})`}>
          {fmtMetricValue(metric.targetValue, metric.unit)}
        </Row>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${metric.p * 100}%`, background: bandCss(metric.band) }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AssetDetailsDrawer() {
  const { selectedFeature, setSelectedId } = useMapState();

  useEffect(() => {
    if (!selectedFeature) return;
    const onEsc = (e) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [selectedFeature, setSelectedId]);

  if (!selectedFeature) return null;

  const p = selectedFeature.properties;
  const c = p.compliance;

  return (
    <div className="asset-details-overlay" onClick={() => setSelectedId(null)}>
      <aside
        className="asset-details-drawer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Asset details"
      >
        <div className="drawer-controls">
          <div className="drawer-controls-info">
            <h2>{p.name}</h2>
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

        <div className="drawer-body">
          <div className="drawer-stat-block">
            <h3>Performance vs Target</h3>
            {METRICS.map((m) => (
              <MetricCard key={m.key} label={m.label} metric={p.metrics[m.key]} />
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
            <Row label="BC1.1 Design/Construction">{p.cert.bc11 ?? 'None'}</Row>
            <Row label="BC1.2 Operational">{p.cert.bc12 ?? 'None'}</Row>
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
