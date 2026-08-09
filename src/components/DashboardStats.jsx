import { useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { computeAggregateStats } from '../data/aggregateStats';
import { bandCss } from '../data/colorScale';
import { fmtPct } from '../data/format';
import GoalsEditor from './GoalsEditor';

function PaceChip({ pace, paceBand }) {
  if (!pace) return null;
  return (
    <span className="chip aggregate-pace-chip" style={{ background: bandCss(paceBand) }}>
      {pace}
    </span>
  );
}

function AggregateStat({ stat }) {
  const goal = stat.goal;
  return (
    <div className="aggregate-stat">
      <div className="aggregate-stat-top">
        <span className="aggregate-stat-label">{stat.label}</span>
        {goal?.pace ? <PaceChip pace={goal.pace} paceBand={goal.paceBand} /> : null}
      </div>
      <span className="aggregate-stat-value">{stat.value}</span>
      {goal?.goalLine ? <span className="aggregate-stat-goal">{goal.goalLine}</span> : null}
      {goal?.p != null ? (
        <div className="progress-track aggregate-progress">
          <div
            className="progress-fill"
            style={{
              width: `${goal.p * 100}%`,
              background: bandCss(goal.paceBand),
            }}
          />
        </div>
      ) : null}
      {goal ? (
        <span className="aggregate-stat-deadline">
          {[goal.deadlineHint, goal.p != null ? `${fmtPct(goal.p)} to goal` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      ) : null}
      <span className="aggregate-stat-hint">{stat.hint}</span>
    </div>
  );
}

export default function DashboardStats() {
  const { visibleFeatures, portfolioGoals, loadedAt } = useMapState();
  const [editingGoals, setEditingGoals] = useState(false);

  const stats = useMemo(
    () => computeAggregateStats(visibleFeatures, portfolioGoals, loadedAt),
    [visibleFeatures, portfolioGoals, loadedAt]
  );

  return (
    <aside className="dashboard-stats" aria-label="Dashboard statistics">
      <div className="dashboard-stats-header">
        <span className="dashboard-stats-title">Portfolio stats</span>
        <button
          type="button"
          className="goals-open-btn"
          onClick={() => setEditingGoals(true)}
        >
          Performance goals
        </button>
      </div>

      {editingGoals ? (
        <GoalsEditor onClose={() => setEditingGoals(false)} />
      ) : (
        <div className="dashboard-stats-list">
          {Object.entries(stats).map(([id, stat]) => (
            <AggregateStat key={id} stat={stat} />
          ))}
        </div>
      )}
    </aside>
  );
}
