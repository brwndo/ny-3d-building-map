import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { useMapState } from '../context/MapStateContext';
import Modal from './Modal';

const REPORT_TYPES = [
  {
    id: 'll97',
    name: 'LL97 Quarterly Report',
    description: 'Penalty exposure, covered square footage, and assets still short of the 2030–2034 cap.',
    cadence: 'Quarterly',
  },
  {
    id: 'energy-star',
    name: 'Energy Star Board Updates',
    description: 'Score distribution, 12-month completeness, and certification eligibility for leadership review.',
    cadence: 'Quarterly',
  },
  {
    id: 'gresb',
    name: 'GRESB Investor Brief',
    description: 'Standing Investments evidence snapshot for LPs — coverage, performance indicators, and remaining gaps.',
    cadence: 'Annual',
  },
  {
    id: 'net-zero',
    name: 'Net Zero Progress Memo',
    description: 'Scope 1+2 trajectory to 2050, remaining carbon, and assets off the pathway.',
    cadence: 'Annual',
  },
  {
    id: 'custom',
    name: 'Internal Target Review',
    description: 'Status against the custom program’s targets for ENERGY STAR, GHG, EUI, water, and coverage.',
    cadence: 'As needed',
  },
];

const INITIAL_REPORTS = [
  {
    id: 'rpt-ll97-q2',
    typeId: 'll97',
    name: 'LL97 Quarterly Report',
    lastRun: 'Jul 2, 2026',
    scope: 'Full portfolio',
    status: 'ready',
  },
  {
    id: 'rpt-estar',
    typeId: 'energy-star',
    name: 'Energy Star Board Updates',
    lastRun: 'Jun 18, 2026',
    scope: 'Full portfolio',
    status: 'ready',
  },
  {
    id: 'rpt-gresb-2026',
    typeId: 'gresb',
    name: 'GRESB Investor Brief',
    lastRun: 'Jul 12, 2026',
    scope: 'Full portfolio',
    status: 'ready',
  },
  {
    id: 'rpt-netzero',
    typeId: 'net-zero',
    name: 'Net Zero Progress Memo',
    lastRun: 'Never',
    scope: 'Assets in view',
    status: 'draft',
  },
];

function typeMeta(typeId) {
  return REPORT_TYPES.find((t) => t.id === typeId);
}

function statusLabel(status) {
  if (status === 'running') return 'Running';
  if (status === 'draft') return 'Draft';
  return 'Ready';
}

export default function ReportsModal({ open, onClose }) {
  const { features, visibleFeatures } = useMapState();
  const [view, setView] = useState('list');
  const [reports, setReports] = useState(INITIAL_REPORTS);
  const [name, setName] = useState('');
  const [typeId, setTypeId] = useState(REPORT_TYPES[0].id);
  const [scope, setScope] = useState('view');
  const nameId = useId();
  const typeIdAttr = useId();

  const resetCreate = () => {
    setName('');
    setTypeId(REPORT_TYPES[0].id);
    setScope('view');
  };

  const handleClose = () => {
    setView('list');
    resetCreate();
    onClose();
  };

  const runReport = (id) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'running' } : r)),
    );
    window.setTimeout(() => {
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status: 'ready', lastRun: 'Just now' } : r,
        ),
      );
    }, 1100);
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const scopeLabel = scope === 'view' ? 'Assets in view' : 'Full portfolio';
    const next = {
      id: `rpt-${Date.now()}`,
      typeId,
      name: trimmed,
      lastRun: 'Just now',
      scope: scopeLabel,
      status: 'ready',
    };
    setReports((prev) => [next, ...prev]);
    resetCreate();
    setView('list');
  };

  const inView = visibleFeatures.length;
  const total = features.length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={view === 'list' ? 'Reports' : 'New report'}
      subtitle={
        view === 'list'
          ? 'Run a saved report or generate a new one from a template.'
          : 'Name the report, pick a template, and choose which assets to include.'
      }
      panelClassName="app-modal-panel--reports"
      headerActions={
        view === 'list' ? (
          <button
            type="button"
            className="goals-primary-btn reports-new-btn"
            onClick={() => setView('create')}
          >
            <Plus aria-hidden="true" />
            New report
          </button>
        ) : null
      }
    >
      {view === 'list' ? (
        <div className="app-modal-body reports-list">
          {reports.map((report) => {
            const meta = typeMeta(report.typeId);
            const running = report.status === 'running';
            return (
              <article key={report.id} className="report-row">
                <div className="report-row-copy">
                  <div className="report-row-title">
                    <h3>{report.name}</h3>
                    <span className={`report-status report-status--${report.status}`}>
                      {statusLabel(report.status)}
                    </span>
                  </div>
                  <p>{meta?.description}</p>
                  <p className="report-row-meta">
                    {meta?.cadence}
                    {' · '}
                    {report.scope}
                    {' · '}
                    Last run {report.lastRun}
                  </p>
                </div>
                <button
                  type="button"
                  className="goals-secondary-btn"
                  onClick={() => runReport(report.id)}
                  disabled={running}
                >
                  {running ? 'Running…' : 'Run'}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <form className="app-modal-body reports-create" onSubmit={handleGenerate}>
          <label className="reports-field" htmlFor={nameId}>
            <span>Report name</span>
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. LL97 Quarterly Report — Q3"
              required
              autoFocus
            />
          </label>

          <label className="reports-field" htmlFor={typeIdAttr}>
            <span>Template</span>
            <select
              id={typeIdAttr}
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="reports-field-hint">{typeMeta(typeId)?.description}</span>
          </label>

          <fieldset className="reports-field">
            <legend>Scope</legend>
            <label className="reports-radio">
              <input
                type="radio"
                name="report-scope"
                value="view"
                checked={scope === 'view'}
                onChange={() => setScope('view')}
              />
              <span>
                Assets in view
                <span className="reports-field-hint">
                  {inView} of {total} currently shown on the map
                </span>
              </span>
            </label>
            <label className="reports-radio">
              <input
                type="radio"
                name="report-scope"
                value="portfolio"
                checked={scope === 'portfolio'}
                onChange={() => setScope('portfolio')}
              />
              <span>
                Full portfolio
                <span className="reports-field-hint">{total} assets</span>
              </span>
            </label>
          </fieldset>

          <div className="reports-create-actions">
            <button
              type="button"
              className="goals-secondary-btn"
              onClick={() => {
                resetCreate();
                setView('list');
              }}
            >
              Back
            </button>
            <button type="submit" className="goals-primary-btn" disabled={!name.trim()}>
              Generate
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
