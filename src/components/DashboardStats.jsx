import { useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { computeAggregateStats } from '../data/aggregateStats';
import { bandCss } from '../data/colorScale';
import { fmtPct } from '../data/format';
import GoalsEditor from './GoalsEditor';
import PortfolioComposition from './PortfolioComposition';
import Tooltip from './Tooltip';

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="5" r="1" fill="currentColor" />
      <path d="M8 7.25v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M11.5 2.5l2 2L5.75 12.25 3.5 12.5l.25-2.25L11.5 2.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 13.5h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PaceChip({ pace, paceBand }) {
  if (!pace) return null;
  return (
    <span className="chip aggregate-pace-chip" style={{ background: bandCss(paceBand) }}>
      {pace}
    </span>
  );
}

function BlockerButton({ stat }) {
  const { focusMetricKey, setFocusMetricKey } = useMapState();
  const count = stat.blockerIds?.length ?? 0;
  if (!stat.metricKey || count === 0) return null;

  const active = focusMetricKey === stat.metricKey;

  return (
    <button
      type="button"
      className="stat-blocker-btn"
      aria-pressed={active}
      onClick={() => setFocusMetricKey(active ? null : stat.metricKey)}
    >
      {active ? 'Hide blockers' : `Show blockers (${count})`}
    </button>
  );
}

function AggregateStat({ stat, headline = false }) {
  const { goal, progress } = stat;
  // A completion stat carries the band it earned; a goal stat colors its bar by
  // whether the portfolio is keeping pace.
  const bar = progress ?? (goal?.p != null ? { p: goal.p, band: goal.paceBand } : null);
  const pace = progress?.pace ?? goal?.pace;
  const paceBand = progress?.paceBand ?? goal?.paceBand;
  const caption =
    progress?.caption ??
    (goal
      ? [goal.deadlineHint, goal.p != null ? `${fmtPct(goal.p)} to goal` : null]
          .filter(Boolean)
          .join(' · ')
      : null);

  return (
    <div className={`aggregate-stat${headline ? ' aggregate-stat--headline' : ''}`}>
      <div className="aggregate-stat-top">
        <span className="aggregate-stat-label">{stat.label}</span>
        {pace ? <PaceChip pace={pace} paceBand={paceBand} /> : null}
      </div>
      <span className="aggregate-stat-value">{stat.value}</span>
      {goal?.goalLine ? <span className="aggregate-stat-goal">{goal.goalLine}</span> : null}
      {bar ? (
        <div className="progress-track aggregate-progress">
          <div
            className="progress-fill"
            style={{ width: `${bar.p * 100}%`, background: bandCss(bar.band) }}
          />
        </div>
      ) : null}
      {caption ? <span className="aggregate-stat-deadline">{caption}</span> : null}
      <span className="aggregate-stat-hint">{stat.hint}</span>
      <BlockerButton stat={stat} />
    </div>
  );
}

export default function DashboardStats() {
  const { visibleFeatures, goalProgram, programGoals, metricBandFor, scoreFor, loadedAt } =
    useMapState();
  const [editingGoals, setEditingGoals] = useState(false);

  const stats = useMemo(
    () =>
      computeAggregateStats(visibleFeatures, {
        program: goalProgram,
        programGoals,
        metricBandFor,
        scoreFor,
        now: loadedAt,
      }),
    [visibleFeatures, goalProgram, programGoals, metricBandFor, scoreFor, loadedAt]
  );

  return (
    <aside className="dashboard-stats" aria-label="Dashboard statistics">
      <div className="dashboard-stats-header">
        {/* The program is chosen in the topbar; purpose/authority live in the tip. */}
        <div className="program-active-header">
          <div className="program-active-row">
            <span className="program-select-label">Goal program</span>
            <div className="program-active-name-row">
              <span className="program-active-name">{goalProgram.label}</span>
              <Tooltip
                label={`About ${goalProgram.label}`}
                content={
                  <>
                    <p>{goalProgram.purpose}</p>
                    <p className="tooltip-meta">Authority: {goalProgram.authority}</p>
                  </>
                }
              >
                <button
                  type="button"
                  className="info-tip-btn"
                  aria-label={`About ${goalProgram.label}`}
                >
                  <InfoIcon />
                </button>
              </Tooltip>
            </div>
          </div>
          {!editingGoals && goalProgram.editable ? (
            <button
              type="button"
              className="info-tip-btn"
              aria-label="Edit custom targets"
              onClick={() => setEditingGoals(true)}
            >
              <EditIcon />
            </button>
          ) : null}
        </div>
      </div>

      {editingGoals ? (
        <GoalsEditor onClose={() => setEditingGoals(false)} />
      ) : (
        <div className="dashboard-stats-list">
          {Object.entries(stats).map(([id, stat]) => (
            <AggregateStat key={id} stat={stat} headline={id === 'programCompletion'} />
          ))}
          <PortfolioComposition />
        </div>
      )}
    </aside>
  );
}
