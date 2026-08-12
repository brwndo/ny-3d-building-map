import { useEffect, useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { fmtMetricValue } from '../data/format';
import {
  GOAL_METRIC_KEYS,
  deadlineYearFromGoal,
  derivePortfolioGoals,
  goalMetricMeta,
  patchPortfolioGoal,
  unitForMetric,
} from '../data/portfolioGoals';
import Modal from './Modal';

const PROCESS_STEPS = [
  {
    title: 'Name & purpose',
    body: 'Label the program so the team knows what it is for. Purpose is optional context.',
  },
  {
    title: 'Choose metrics',
    body: 'Pick which portfolio metrics the program governs. Unchecked metrics keep plan defaults but stay off this program’s focus.',
  },
  {
    title: 'Set targets & deadlines',
    body: 'Same fields as Custom program edit — absolute targets (GHG, water) are split across assets by floor-area share.',
  },
  {
    title: 'Apply to the map',
    body: 'Create switches the dashboard to Custom and colors assets against the targets you set.',
  },
];

function displayTarget(value, unit) {
  if (value == null || !Number.isFinite(value)) return '';
  if (unit === '%') return String(Number((value * 100).toFixed(1)));
  if (unit === '1-100') return String(Math.round(value));
  return String(value);
}

function parseTargetInput(raw, unit) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (unit === '%') return n / 100;
  return n;
}

function unitSuffix(unit) {
  if (!unit || unit === '1-100') return '';
  if (unit === '%') return '%';
  return unit;
}

export default function CreateProgramModal({ open, onClose }) {
  const { features, portfolioGoals, setPortfolioGoals, setGoalProgram } = useMapState();
  const defaults = useMemo(() => derivePortfolioGoals(features), [features]);

  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(GOAL_METRIC_KEYS.map((key) => [key, true])),
  );
  const [draft, setDraft] = useState(portfolioGoals);

  useEffect(() => {
    if (!open) return;
    setName('');
    setPurpose('');
    setSelected(Object.fromEntries(GOAL_METRIC_KEYS.map((key) => [key, true])));
    setDraft(portfolioGoals);
  }, [open, portfolioGoals]);

  const metricKeys = GOAL_METRIC_KEYS.filter((key) => selected[key]);
  const canCreate = name.trim().length > 0 && metricKeys.length > 0;

  const toggleMetric = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateRow = (key, patch) => {
    setDraft((prev) => patchPortfolioGoal(prev, key, patch));
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setPortfolioGoals(draft);
    setGoalProgram('custom');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create program"
      subtitle="Build a custom program with the same targets editor used for Custom."
      panelClassName="app-modal-panel--create-program"
    >
      <form className="app-modal-body create-program-form" onSubmit={handleCreate}>
        <section className="create-program-process" aria-label="How creating a program works">
          <h3 className="create-program-section-title">How it works</h3>
          <ol className="create-program-steps">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.title} className="create-program-step">
                <span className="create-program-step-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <div className="create-program-step-title">{step.title}</div>
                  <p className="create-program-step-body">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="create-program-section" aria-label="Program details">
          <h3 className="create-program-section-title">Program details</h3>
          <label className="reports-field">
            <span>Program name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Internal 2030 carbon plan"
              required
            />
          </label>
          <label className="reports-field">
            <span>Purpose</span>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="What this program is for (optional)"
            />
          </label>
        </section>

        <section className="create-program-section" aria-label="Metrics and targets">
          <h3 className="create-program-section-title">Metrics & targets</h3>
          <p className="create-program-note">
            Same fields as Custom program edit. Absolute targets (GHG, water) are split across
            assets by floor-area share to color the map.
          </p>
          <div className="goals-editor-body create-program-metrics">
            {GOAL_METRIC_KEYS.map((key) => {
              const meta = goalMetricMeta(key);
              const unit = unitForMetric(features, key);
              const goal = draft[key];
              const defaultGoal = defaults[key];
              const checked = Boolean(selected[key]);
              const label = meta?.label ?? key;

              return (
                <div
                  key={key}
                  className={`goals-editor-row create-program-metric-row${
                    checked ? '' : ' create-program-metric-row--off'
                  }`}
                >
                  <label className="create-program-metric-toggle">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMetric(key)}
                    />
                    <span className="goals-editor-row-label">
                      <span>{label}</span>
                      <span className="goals-editor-default">
                        Plan default {fmtMetricValue(defaultGoal?.targetValue, unit)}
                        {defaultGoal?.deadline
                          ? ` · ${deadlineYearFromGoal(defaultGoal)}`
                          : ''}
                      </span>
                    </span>
                  </label>
                  <label className="goals-editor-field">
                    <span>Target{unitSuffix(unit) ? ` (${unitSuffix(unit)})` : ''}</span>
                    <input
                      type="number"
                      step="any"
                      disabled={!checked}
                      value={displayTarget(goal?.targetValue, unit)}
                      onChange={(e) => {
                        const parsed = parseTargetInput(e.target.value, unit);
                        if (parsed != null) updateRow(key, { targetValue: parsed });
                      }}
                    />
                  </label>
                  <label className="goals-editor-field">
                    <span>Deadline year</span>
                    <input
                      type="number"
                      min="2020"
                      max="2100"
                      step="1"
                      disabled={!checked}
                      value={deadlineYearFromGoal(goal) ?? ''}
                      onChange={(e) => {
                        const year = Number(e.target.value);
                        if (Number.isFinite(year)) updateRow(key, { deadlineYear: year });
                      }}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <div className="goals-editor-actions create-program-actions">
          <p className="create-program-apply-hint">
            {canCreate
              ? `Creates “${name.trim()}”${purpose.trim() ? ` — ${purpose.trim()}` : ''} and switches to Custom.`
              : 'Name the program and keep at least one metric on.'}
          </p>
          <div className="goals-editor-actions-right">
            <button type="button" className="goals-secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="goals-primary-btn" disabled={!canCreate}>
              Create program
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
