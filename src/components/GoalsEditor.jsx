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

export default function GoalsEditor({ onClose }) {
  const { features, portfolioGoals, setPortfolioGoals, resetPortfolioGoals } = useMapState();
  const defaults = useMemo(() => derivePortfolioGoals(features), [features]);
  const [draft, setDraft] = useState(portfolioGoals);

  useEffect(() => {
    setDraft(portfolioGoals);
  }, [portfolioGoals]);

  const rows = GOAL_METRIC_KEYS.map((key) => {
    const meta = goalMetricMeta(key);
    const unit = unitForMetric(features, key);
    const goal = draft[key];
    const defaultGoal = defaults[key];
    return { key, label: meta?.label ?? key, unit, goal, defaultGoal };
  });

  const updateRow = (key, patch) => {
    setDraft((prev) => patchPortfolioGoal(prev, key, patch));
  };

  const handleSave = () => {
    setPortfolioGoals(draft);
    onClose();
  };

  const handleReset = () => {
    resetPortfolioGoals();
    onClose();
  };

  return (
    <div className="goals-editor" aria-label="Performance goals editor">
      <div className="goals-editor-header">
        <div>
          <h2>Performance goals</h2>
          <p className="goals-editor-sub">
            Portfolio targets and deadlines. Map colors still use per-asset targets.
          </p>
        </div>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="goals-editor-body">
        {rows.map(({ key, label, unit, goal, defaultGoal }) => (
          <div key={key} className="goals-editor-row">
            <div className="goals-editor-row-label">
              <span>{label}</span>
              <span className="goals-editor-default">
                Plan default {fmtMetricValue(defaultGoal?.targetValue, unit)}
                {defaultGoal?.deadline
                  ? ` · ${deadlineYearFromGoal(defaultGoal)}`
                  : ''}
              </span>
            </div>
            <label className="goals-editor-field">
              <span>Target{unitSuffix(unit) ? ` (${unitSuffix(unit)})` : ''}</span>
              <input
                type="number"
                step="any"
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
                value={deadlineYearFromGoal(goal) ?? ''}
                onChange={(e) => {
                  const year = Number(e.target.value);
                  if (Number.isFinite(year)) updateRow(key, { deadlineYear: year });
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="goals-editor-actions">
        <button type="button" className="goals-secondary-btn" onClick={handleReset}>
          Reset to plan
        </button>
        <div className="goals-editor-actions-right">
          <button type="button" className="goals-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="goals-primary-btn" onClick={handleSave}>
            Save goals
          </button>
        </div>
      </div>
    </div>
  );
}
