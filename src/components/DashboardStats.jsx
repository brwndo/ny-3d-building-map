import { useEffect, useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import {
  computeAggregateStats,
  computeAssetBandBreakdown,
  METRIC_TILE_CHART_TYPES,
} from '../data/aggregateStats';
import { bandCss, GREY, METRICS } from '../data/colorScale';
import { fmtPct } from '../data/format';
import {
  bandForProgress,
  confidenceBreakdown,
  isAtRiskBand,
  mapScaleFor,
  MAP_SCALE_TYPES,
  OVERVIEW_CHART_TYPES,
} from '../data/goalPrograms';
import BulletChart from './BulletChart';
import ShareVsRequiredBar from './ShareVsRequiredBar';
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4 4l8 8M12 4l-8 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2l1.2 6.3L20 10l-6.8 1.7L12 18l-1.2-6.3L4 10l6.8-1.7L12 2z"
        fill="currentColor"
        opacity="0.35"
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

function AggregateStat({ stat }) {
  const { goal, progress } = stat;
  const bar = progress ?? (goal?.p != null ? { p: goal.p, band: goal.paceBand } : null);
  const pace = progress?.pace ?? goal?.pace;
  const paceBand = progress?.paceBand ?? goal?.paceBand;

  const tileChart = stat.tileChart ?? METRIC_TILE_CHART_TYPES.bullet;
  const canChart =
    goal &&
    stat.currentValue != null &&
    goal.targetValue != null &&
    Number.isFinite(stat.currentValue) &&
    Number.isFinite(goal.targetValue);

  const showScoreRanges =
    tileChart === METRIC_TILE_CHART_TYPES.scoreRanges && stat.scoreRanges?.total > 0;
  const showAssetCount =
    !showScoreRanges &&
    tileChart === METRIC_TILE_CHART_TYPES.assetCount &&
    stat.met != null &&
    stat.total != null &&
    stat.total > 0;
  const showShareVsRequired =
    !showScoreRanges &&
    !showAssetCount &&
    canChart &&
    tileChart === METRIC_TILE_CHART_TYPES.shareVsRequired;
  const showBullet =
    !showScoreRanges &&
    !showAssetCount &&
    canChart &&
    tileChart === METRIC_TILE_CHART_TYPES.bullet &&
    goal.baselineValue != null &&
    Number.isFinite(goal.baselineValue);

  const tipContent = stat.about ?? goal?.goalLine ?? null;
  const hasTip = Boolean(tipContent);
  const assetCountBand = bandForProgress(goal?.p ?? bar?.p) ?? goal?.paceBand ?? bar?.band;

  return (
    <div className="aggregate-stat">
      <div className="aggregate-stat-top">
        <div className="aggregate-stat-label-row">
          <span className="aggregate-stat-label">{stat.label}</span>
          {hasTip ? (
            <Tooltip
              label={`About ${stat.label}`}
              content={<p>{tipContent}</p>}
            >
              <button
                type="button"
                className="info-tip-btn"
                aria-label={`About ${stat.label}`}
              >
                <InfoIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {!showScoreRanges && pace ? <PaceChip pace={pace} paceBand={paceBand} /> : null}
      </div>
      <span className="aggregate-stat-value">{stat.value}</span>
      {showScoreRanges ? (
        <ScoreRangeBreakdown ranges={stat.scoreRanges} />
      ) : showAssetCount ? (
        <div className="aggregate-asset-count">
          <UnitBar
            count={stat.met}
            total={stat.total}
            color={bandCss(assetCountBand ?? 'Off Track')}
          />
          {goal?.targetValue != null ? (
            <p className="aggregate-asset-required">
              Need {fmtPct(goal.targetValue)} of assets
              {stat.total > 0
                ? ` (${Math.ceil(goal.targetValue * stat.total)} of ${stat.total})`
                : ''}
            </p>
          ) : null}
        </div>
      ) : showShareVsRequired ? (
        <ShareVsRequiredBar
          current={stat.currentValue}
          target={goal.targetValue}
          unit={goal.unit ?? stat.unit}
        />
      ) : showBullet ? (
        <BulletChart
          current={stat.currentValue}
          baseline={goal.baselineValue}
          target={goal.targetValue}
          expectedP={goal.expectedP}
          direction={stat.direction}
          unit={goal.unit ?? stat.unit}
          band={bandForProgress(goal.p) ?? goal.paceBand}
        />
      ) : bar ? (
        <div className="progress-track aggregate-progress">
          <div
            className="progress-fill"
            style={{ width: `${bar.p * 100}%`, background: bandCss(bar.band) }}
          />
        </div>
      ) : null}
      <BlockerButton stat={stat} />
    </div>
  );
}

function ScoreRangeBreakdown({ ranges }) {
  if (!ranges?.rows?.length || ranges.total === 0) return null;

  return (
    <div
      className="band-breakdown-list aggregate-score-ranges"
      role="img"
      aria-label="ENERGY STAR score distribution"
    >
      {ranges.rows.map((row) => (
        <div key={row.label} className="band-breakdown-row">
          <span className="band-breakdown-name">{row.label}</span>
          <span className="band-breakdown-pct">{fmtPct(row.pct)}</span>
          <span className="band-breakdown-count">
            <span className="band-breakdown-count-n">
              {String(row.count).padStart(2, '0')}
            </span>
            <span className="band-breakdown-count-total">/{row.total}</span>
          </span>
          <UnitBar count={row.count} total={row.total} color={row.color} />
        </div>
      ))}
    </div>
  );
}

function yearFraction(date) {
  return date.getFullYear() + (date.getMonth() + date.getDate() / 31) / 12;
}

function formatDeadlineShort(endYear, now) {
  if (endYear == null) return { label: '—', relative: null };
  const yearsLeft = endYear - yearFraction(now);
  let relative;
  if (yearsLeft < 0) {
    relative = `${Math.max(1, Math.ceil(-yearsLeft))}y overdue`;
  } else if (yearsLeft < 1) {
    relative = `${Math.max(1, Math.round(yearsLeft * 12))}mo left`;
  } else {
    relative = `in ${Math.round(yearsLeft)}yrs`;
  }
  return { label: `Dec ${endYear}`, relative };
}

/**
 * Actual progress vs linear trajectory to the deadline (two separate lines).
 */
function buildCompletionSeries(progress, now = new Date()) {
  if (!progress || progress.p == null) return null;

  const startYear = progress.startYear ?? now.getFullYear() - 3;
  const endYear = progress.endYear ?? now.getFullYear() + 2;
  const nowY = yearFraction(now);
  const actual = Math.min(1, Math.max(0, progress.p));
  const span = Math.max(0.01, endYear - startYear);
  const nowT = Math.min(1, Math.max(0, (nowY - startYear) / span));
  const expected =
    progress.expectedP != null
      ? Math.min(1, Math.max(0, progress.expectedP))
      : nowT;

  return {
    startYear,
    endYear,
    nowY,
    nowT,
    actual,
    expected,
    delta: actual - expected,
  };
}

function ComplianceSplitChart({ split }) {
  if (!split || split.covered === 0) return null;

  const rows = [
    {
      band: split.metLabel,
      count: split.met,
      pct: split.metShare,
      total: split.covered,
    },
    {
      band: split.unmetLabel,
      count: split.unmet,
      pct: split.unmetShare,
      total: split.covered,
    },
  ];

  return (
    <div
      className="band-breakdown-list"
      role="img"
      aria-label={`${split.metLabel} versus ${split.unmetLabel}`}
    >
      {rows.map((row) => (
        <div key={row.band} className="band-breakdown-row">
          <span className="band-breakdown-name">{row.band}</span>
          <span className="band-breakdown-pct">{fmtPct(row.pct)}</span>
          <span className="band-breakdown-count">
            <span className="band-breakdown-count-n">
              {String(row.count).padStart(2, '0')}
            </span>
            <span className="band-breakdown-count-total">/{row.total}</span>
          </span>
          <UnitBar count={row.count} total={row.total} color={bandCss(row.band)} />
        </div>
      ))}
    </div>
  );
}

function ReadinessGatesChart({ gates }) {
  if (!gates?.length) return null;

  return (
    <div className="overview-gates" role="img" aria-label="Submission gate readiness">
      {gates.map((gate, index) =>
        gate.chart === METRIC_TILE_CHART_TYPES.assetCount ? (
          <div
            key={gate.key}
            className="share-vs-required gate-asset-count"
            role="img"
            aria-label={`${gate.label}: ${gate.met} of ${gate.total} assets (need ${fmtPct(gate.target)})`}
          >
            <div className="share-vs-required-head">
              <span className="share-vs-required-label">{gate.label}</span>
              <span className="share-vs-required-values">
                {gate.met} / {gate.total}
              </span>
            </div>
            <UnitBar
              count={gate.met}
              total={gate.total}
              color={bandCss(gate.band ?? (gate.metGate ? 'Target Met' : 'Off Track'))}
            />
            <p className="aggregate-asset-required">
              Need {fmtPct(gate.target)} of assets
              {gate.total > 0
                ? ` (${Math.ceil(gate.target * gate.total)} of ${gate.total})`
                : ''}
            </p>
            {index === gates.length - 1 ? (
              <div className="share-vs-required-legend">
                <span>
                  <i
                    className="share-vs-required-swatch share-vs-required-swatch--fill"
                    style={{
                      background: bandCss(
                        gate.band ?? (gate.metGate ? 'Target Met' : 'Off Track')
                      ),
                    }}
                  />
                  Passing
                </span>
                <span>
                  <i
                    className="share-vs-required-swatch"
                    style={{ background: '#e8e8e8' }}
                  />
                  Short
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <ShareVsRequiredBar
            key={gate.key}
            current={gate.current}
            target={gate.target}
            unit={gate.unit}
            label={gate.label}
            showLegend={index === gates.length - 1}
          />
        )
      )}
    </div>
  );
}

function ComplianceGoalRing({ value, progress, about, description, delta }) {
  const p = Math.min(1, Math.max(0, progress?.p ?? 0));
  const size = 148;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - p);
  const fill = bandCss(progress?.band ?? bandForProgress(p) ?? 'Off Track');

  return (
    <div className="goal-ring">
      <div
        className="goal-ring-chart"
        role="img"
        aria-label={`Goal completion: ${value}${description ? `. ${description}` : ''}`}
      >
        <svg
          className="goal-ring-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <circle
            className="goal-ring-track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            className="goal-ring-progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            fill="none"
            stroke={fill}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="goal-ring-center">
          <span className="goal-ring-value">{value}</span>
        </div>
      </div>
      <div className="goal-ring-heading">
        <div className="completion-kpi-label-row goal-ring-label-row">
          <span className="stats-section-title">Goal completion</span>
          {about ? (
            <Tooltip label="About goal completion" content={<p>{about}</p>}>
              <button type="button" className="info-tip-btn" aria-label="About goal completion">
                <InfoIcon />
              </button>
            </Tooltip>
          ) : null}
        </div>
        {description ? <p className="goal-ring-description">{description}</p> : null}
        {delta != null ? (
          <span
            className={`completion-kpi-delta${delta >= 0 ? ' completion-kpi-delta--up' : ' completion-kpi-delta--down'}`}
          >
            {delta >= 0 ? '+' : ''}
            {fmtPct(delta)} vs expected
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DeadlineTrendChart({ series, deadline }) {
  if (!series || series.endYear == null) return null;

  const w = 420;
  const h = 120;
  const padL = 8;
  const padR = 28;
  const padT = 10;
  const padB = 22;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const viewStart = series.startYear;
  const viewEnd = series.endYear;
  const viewSpan = Math.max(0.01, viewEnd - viewStart);
  const xOf = (year) => padL + ((year - viewStart) / viewSpan) * chartW;
  const yOf = (p) => padT + (1 - p) * chartH;

  const startX = xOf(series.startYear);
  const nowX = xOf(series.nowY);
  const endX = xOf(series.endYear);
  const actualPath = `M ${startX} ${yOf(0)} L ${nowX} ${yOf(series.actual)}`;
  const neededPath = `M ${startX} ${yOf(0)} L ${endX} ${yOf(1)}`;
  const ticks = [0, 0.5, 1];

  return (
    <div className="deadline-trend">
      <div className="deadline-trend-header">
        <div className="deadline-trend-copy">
          <span className="stats-section-title">Deadline</span>
          <div className="deadline-trend-values">
            <span className="deadline-trend-date">{deadline.label}</span>
            {deadline.relative ? (
              <span className="deadline-trend-rel">{deadline.relative}</span>
            ) : null}
          </div>
        </div>
        <div className="deadline-trend-legend">
          <span>
            <i className="completion-history-swatch completion-history-swatch--actual" />
            Actual {fmtPct(series.actual)}
          </span>
          <span>
            <i className="completion-history-swatch completion-history-swatch--trajectory" />
            Needed pace
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="deadline-trend-svg"
        role="img"
        aria-label={`Progress toward ${deadline.label} deadline`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              y1={yOf(t)}
              x2={padL + chartW}
              y2={yOf(t)}
              className="completion-history-grid"
            />
            <text x={padL + chartW + 4} y={yOf(t) + 3} className="completion-history-tick">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <line
          x1={endX}
          y1={padT}
          x2={endX}
          y2={padT + chartH}
          className="completion-history-deadline"
        />
        <text x={endX} y={h - 6} textAnchor="end" className="completion-history-deadline-label">
          {deadline.label}
        </text>
        <path d={neededPath} className="completion-history-trajectory" />
        <path d={actualPath} className="completion-history-actual" />
        <circle cx={nowX} cy={yOf(series.actual)} r="3.5" className="completion-history-now" />
      </svg>
    </div>
  );
}

function CompletionOverview({ completion, now, legendTitle, programGoal }) {
  const progress = completion?.progress;
  const series = useMemo(() => buildCompletionSeries(progress, now), [progress, now]);
  const chartType = completion?.overviewChart ?? OVERVIEW_CHART_TYPES.trajectory;
  const isCompliance = chartType === OVERVIEW_CHART_TYPES.complianceSplit;
  const isReadiness = chartType === OVERVIEW_CHART_TYPES.readinessGates;
  const isTrajectory = !isCompliance && !isReadiness;
  const title = completion?.label ?? (isCompliance ? legendTitle : null) ?? 'Goal completion';
  const about = completion?.hint ?? 'Progress across the active program targets for assets in view.';

  if (!completion || progress?.p == null) {
    return (
      <section className="stats-section stats-completion" aria-label={title}>
        <p className="hint">{completion?.hint ?? 'No measurable targets in view'}</p>
      </section>
    );
  }

  const deadline = formatDeadlineShort(progress.endYear, now);
  const delta = isTrajectory ? series?.delta : null;

  let overviewChart = null;
  if (isCompliance && completion.split) {
    overviewChart = <ComplianceSplitChart split={completion.split} />;
  } else if (isReadiness && completion.gates?.length) {
    overviewChart = <ReadinessGatesChart gates={completion.gates} />;
  }

  return (
    <section
      className="stats-section stats-completion stats-completion--compliance"
      aria-label="Goal completion"
    >
      <ComplianceGoalRing
        value={completion.value}
        progress={progress}
        about={about}
        description={programGoal}
        delta={delta}
      />
      {overviewChart}
      <DeadlineTrendChart series={series} deadline={deadline} />
    </section>
  );
}

/** Prototype-only copy — not wired to a model. Mix of next-step vs do-nothing stakes. */
function buildDirectionalInsight({
  program,
  programLabel,
  bandBreakdown,
  completion,
  compliance,
  features,
}) {
  const rows = bandBreakdown?.rows ?? [];
  const scale = mapScaleFor(program);
  const worstBand = scale.bands.find((b) => b.tone === 'worst')?.key;
  const worstCount = rows.find((r) => r.band === worstBand)?.count ?? 0;
  const riskCount = rows
    .filter((r) => isAtRiskBand(r.band, program))
    .reduce((sum, r) => sum + r.count, 0);
  const splitUnmet = completion?.split?.unmet ?? worstCount;
  const deadlineYear = program.deadlineYear;
  const deadlineLabel = deadlineYear != null ? `Dec ${deadlineYear}` : 'the deadline';
  const conf = confidenceBreakdown(features ?? [], program);
  const assetsWord = (n) => (n === 1 ? 'asset' : 'assets');
  const areWord = (n) => (n === 1 ? 'is' : 'are');

  switch (program.id) {
    case 'll97_2030': {
      // Consequence-led: fines if nothing changes.
      if (splitUnmet > 0) {
        const exposure =
          compliance?.value && compliance.value !== '$0'
            ? ` — about ${compliance.value} at $268/mtCO₂e`
            : ' at $268/mtCO₂e';
        return `If nothing changes by ${deadlineLabel}, ${splitUnmet} over-cap ${assetsWord(splitUnmet)} keep the portfolio in LL97 penalty exposure${exposure}. Cut Scope 1+2 at those buildings to get under the 2030–2034 caps.`;
      }
      return `Every LL97-applicable asset in view is under the cap. Keep coverage and filings current so ${deadlineLabel} does not reopen penalty risk.`;
    }
    case 'energyStar75': {
      // Action-led: how to clear the 75 gate.
      if (splitUnmet > 0) {
        return `Raise ENERGY STAR scores at the ${splitUnmet} ${assetsWord(splitUnmet)} still below 75 — commissioning, envelope, and HVAC tuning usually move the needle fastest — to hit 100% eligibility by ${deadlineLabel}.`;
      }
      return `All assets in view clear the 75+ score gate. Lock in 12-month whole-building data so certification eligibility stays intact through ${deadlineLabel}.`;
    }
    case 'gresbReady': {
      // Action-led: attack the weakest submission gate first.
      const gates = completion?.gates ?? [];
      const shortGates = gates
        .filter((g) => !g.metGate)
        .sort((a, b) => (a.current ?? 0) - (b.current ?? 0));
      const weakest = shortGates[0];
      if (weakest) {
        const shortBy =
          weakest.chart === METRIC_TILE_CHART_TYPES.assetCount && weakest.total > 0
            ? Math.max(0, Math.ceil(weakest.target * weakest.total) - weakest.met)
            : null;
        const gap =
          shortBy != null && shortBy > 0
            ? ` — ${shortBy} more ${assetsWord(shortBy)} still needed`
            : '';
        return `GRESB readiness is held back most by “${weakest.label}”${gap}. Close that bar first so the rest of the ${deadlineLabel} submission package can clear.`;
      }
      if (conf.below > 0) {
        return `${conf.below} ${assetsWord(conf.below)} sit under the ${conf.floorPct}% coverage floor. Lift coverage there before the ${deadlineLabel} GRESB window so evidence stays defensible.`;
      }
      return `Submission gates look clear for assets in view. Re-check verified data and certifications before the ${deadlineLabel} filing so nothing regresses.`;
    }
    case 'netZero2050': {
      // Consequence-led: trajectory stalls without cuts.
      if (riskCount > 0 || worstCount > 0) {
        const n = Math.max(riskCount, worstCount);
        return `Without deeper Scope 1+2 cuts at the ${n} off-pace ${assetsWord(n)}, today’s emissions path misses net zero by 2050. Sequence fuel switching and load reduction on those buildings now.`;
      }
      return `Trajectory is on pace for assets in view. Keep annual abatement projects funded so progress does not stall before 2050.`;
    }
    case 'waterCohort2028': {
      // Action-led: fix overshooting sites.
      if (splitUnmet > 0) {
        return `Bring the ${splitUnmet} over-cohort ${assetsWord(splitUnmet)} under the −10% water bar with leak repair, fixture upgrades, and process-water cuts before ${deadlineLabel}.`;
      }
      return `Every asset in view beats its building-type cohort water target. Hold intensity with metering so ${deadlineLabel} does not slip.`;
    }
    case 'custom':
    default: {
      // Mix: blockers → action; otherwise hold the line.
      if (riskCount > 0 || worstCount > 0) {
        const n = Math.max(riskCount, worstCount);
        return `${n} ${assetsWord(n)} ${areWord(n)} still short of your custom targets. Open those blockers and clear them in deadline order — that is the shortest path to the goals you set.`;
      }
      if (conf.below > 0) {
        return `${programLabel} looks on track, but ${conf.below} ${assetsWord(conf.below)} sit under the coverage floor. Raise data quality there so reported progress stays auditable.`;
      }
      return `${programLabel} is clear for assets in view. Keep targets and deadlines current so the next reporting cycle does not invent new gaps.`;
    }
  }
}

/** Prototype-only copy — not wired to a model. */
function AiInsightsCard({
  programLabel,
  program,
  bandBreakdown,
  completion,
  compliance,
  features,
  onViewAssets,
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [program.id]);

  if (dismissed) return null;

  const body = buildDirectionalInsight({
    program,
    programLabel,
    bandBreakdown,
    completion,
    compliance,
    features,
  });

  return (
    <section className="stats-ai-card" aria-label="AI insights">
      <button
        type="button"
        className="stats-ai-dismiss"
        aria-label="Dismiss insight"
        onClick={() => setDismissed(true)}
      >
        <CloseIcon />
      </button>
      <div className="stats-ai-card-body">
        <div className="stats-ai-kicker">
          <SparkleIcon className="stats-ai-kicker-icon" />
          <span>Insight</span>
        </div>
        <p className="stats-ai-body">{body}</p>
        <button type="button" className="stats-ai-action" onClick={onViewAssets}>
          View Assets
        </button>
      </div>
    </section>
  );
}

function UnitBar({ count, total, color }) {
  const cells = Math.max(total, 1);
  return (
    <div className="band-unit-bar" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span
          key={i}
          className="band-unit-cell"
          style={{ background: i < count ? color : '#e8e8e8' }}
        />
      ))}
    </div>
  );
}

function DataConfidenceCard({ program, features }) {
  const { confidenceGreyEnabled, setConfidenceGrey } = useMapState();
  const breakdown = confidenceBreakdown(features, program);
  if (breakdown.total === 0) return null;

  const greyCss = `rgb(${GREY.join(',')})`;
  const rows = [
    {
      label: 'At or above floor',
      count: breakdown.clear,
      pct: breakdown.clear / breakdown.total,
      color: bandCss('Target Met'),
    },
    {
      label: confidenceGreyEnabled ? 'Below floor — grey' : 'Below floor',
      count: breakdown.below,
      pct: breakdown.below / breakdown.total,
      color: confidenceGreyEnabled ? greyCss : '#c8c8c8',
    },
  ];

  return (
    <section className="stats-section stats-confidence-section" aria-label="Data confidence">
      <div className="stats-section-head">
        <div className="completion-kpi-label-row">
          <h3 className="stats-section-title">Data confidence</h3>
          <Tooltip
            label="About data confidence"
            content={
              <p>
                Assets under {breakdown.floorPct}% data coverage
                {confidenceGreyEnabled
                  ? ' render grey on the map for this program. Color is withheld until coverage clears the floor.'
                  : ' are flagged here, but map color stays on while greying is off.'}
              </p>
            }
          >
            <button type="button" className="info-tip-btn" aria-label="About data confidence">
              <InfoIcon />
            </button>
          </Tooltip>
        </div>
        <label className="confidence-grey-toggle">
          <span>Grey out</span>
          <input
            type="checkbox"
            role="switch"
            checked={confidenceGreyEnabled}
            onChange={(e) => setConfidenceGrey(e.target.checked)}
            aria-label="Grey out assets below the data confidence floor"
          />
        </label>
      </div>
      <p className="stats-section-meta confidence-floor-meta">
        Coverage ≥ {breakdown.floorPct}%
      </p>
      <div className="band-breakdown-list">
        {rows.map((row) => (
          <div key={row.label} className="band-breakdown-row">
            <span className="band-breakdown-name">{row.label}</span>
            <span className="band-breakdown-pct">{fmtPct(row.pct)}</span>
            <span className="band-breakdown-count">
              <span className="band-breakdown-count-n">
                {String(row.count).padStart(2, '0')}
              </span>
              <span className="band-breakdown-count-total">/{breakdown.total}</span>
            </span>
            <UnitBar count={row.count} total={breakdown.total} color={row.color} />
          </div>
        ))}
      </div>
    </section>
  );
}

function BandBreakdown({ breakdown }) {
  const title = breakdown?.title ?? 'Assets by status';

  if (!breakdown || breakdown.covered === 0) {
    return (
      <section className="stats-section stats-band-section" aria-label={title}>
        <div className="stats-section-head">
          <div className="completion-kpi-label-row">
            <h3 className="stats-section-title">{title}</h3>
            <Tooltip
              label={`About ${title}`}
              content={<p>How many scored assets fall into each program color band.</p>}
            >
              <button type="button" className="info-tip-btn" aria-label={`About ${title}`}>
                <InfoIcon />
              </button>
            </Tooltip>
          </div>
        </div>
        <p className="hint">No assets covered by this program in view</p>
      </section>
    );
  }

  return (
    <section className="stats-section stats-band-section" aria-label={title}>
      <div className="stats-section-head">
        <div className="completion-kpi-label-row">
          <h3 className="stats-section-title">{title}</h3>
          <Tooltip
            label={`About ${title}`}
            content={<p>How many scored assets fall into each program color band.</p>}
          >
            <button type="button" className="info-tip-btn" aria-label={`About ${title}`}>
              <InfoIcon />
            </button>
          </Tooltip>
        </div>
      </div>
      <div className="band-breakdown-list">
        {breakdown.rows.map((row) => (
          <div key={row.band} className="band-breakdown-row">
            <span className="band-breakdown-name">{row.band}</span>
            <span className="band-breakdown-pct">{fmtPct(row.pct)}</span>
            <span className="band-breakdown-count">
              <span className="band-breakdown-count-n">
                {String(row.count).padStart(2, '0')}
              </span>
              <span className="band-breakdown-count-total">/{row.total}</span>
            </span>
            <UnitBar count={row.count} total={row.total} color={bandCss(row.band)} />
          </div>
        ))}
      </div>
    </section>
  );
}

const OVERVIEW_KEYS = new Set(['portfolio', 'programCompletion', 'targetsMet']);

export default function DashboardStats() {
  const {
    visibleFeatures,
    goalProgram,
    governedMetrics,
    programGoals,
    metricBandFor,
    scoreFor,
    loadedAt,
    setFocusMetricKey,
  } = useMapState();
  const [editingGoals, setEditingGoals] = useState(false);
  const now = loadedAt ?? new Date();

  const colorTargets = useMemo(
    () => METRICS.filter((m) => governedMetrics.includes(m.key)),
    [governedMetrics]
  );
  const mapScale = mapScaleFor(goalProgram);
  const colorBlurb =
    mapScale.type === MAP_SCALE_TYPES.binary
      ? 'Color shows whether each asset clears the program bar'
      : mapScale.type === MAP_SCALE_TYPES.gateCount
        ? 'Color shows how many submission gates each asset clears'
        : mapScale.type === MAP_SCALE_TYPES.trajectory
          ? 'Color shows trajectory progress toward the program target'
          : 'Color shows progress across the program targets';

  const stats = useMemo(
    () =>
      computeAggregateStats(visibleFeatures, {
        program: goalProgram,
        programGoals,
        metricBandFor,
        scoreFor,
        now,
      }),
    [visibleFeatures, goalProgram, programGoals, metricBandFor, scoreFor, now]
  );

  const bandBreakdown = useMemo(
    () => computeAssetBandBreakdown(visibleFeatures, scoreFor, goalProgram),
    [visibleFeatures, scoreFor, goalProgram]
  );

  const detailStats = useMemo(
    () => Object.entries(stats).filter(([id]) => !OVERVIEW_KEYS.has(id)),
    [stats]
  );

  const portfolioCount = visibleFeatures.length;
  const portfolioSqFt = stats.portfolio?.hint ?? '—';

  const viewAssets = () => {
    const withBlockers = detailStats
      .map(([, stat]) => stat)
      .filter((stat) => (stat.blockerIds?.length ?? 0) > 0)
      .sort((a, b) => (b.blockerIds?.length ?? 0) - (a.blockerIds?.length ?? 0));
    if (withBlockers[0]?.metricKey) {
      setFocusMetricKey(withBlockers[0].metricKey);
    }
  };

  return (
    <aside className="dashboard-stats" aria-label="Dashboard statistics">
      <div className="dashboard-stats-header">
        <div className="program-active-header">
          <div className="program-active-row">
            <div className="program-select-label-row">
              <span className="program-select-label">Goal program</span>
              <Tooltip
                label={`About ${goalProgram.label}`}
                content={
                  <>
                    <p>{goalProgram.purpose}</p>
                    <p className="tooltip-meta">Authority: {goalProgram.authority}</p>
                    <p>
                      {colorBlurb}
                      {colorTargets.length > 0 ? ':' : '.'}
                    </p>
                    <ul className="program-target-list">
                      {colorTargets.map((m) => (
                        <li key={m.key}>{m.label}</li>
                      ))}
                    </ul>
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
            <span className="program-active-name">{goalProgram.label}</span>
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
        <div className="program-portfolio-meta">
          <div className="program-portfolio-pair">
            <span className="program-portfolio-label">Assets in view</span>
            <span className="program-portfolio-value">{portfolioCount}</span>
          </div>
          <div className="program-portfolio-pair">
            <span className="program-portfolio-label">Total sq. ft. in view</span>
            <span className="program-portfolio-value">
              {typeof portfolioSqFt === 'string'
                ? portfolioSqFt.replace(/\s*sq ft$/i, '')
                : portfolioSqFt}
            </span>
          </div>
        </div>
      </div>

      {editingGoals ? (
        <GoalsEditor onClose={() => setEditingGoals(false)} />
      ) : (
        <div className="dashboard-stats-body">
          <CompletionOverview
            completion={stats.programCompletion}
            now={now}
            legendTitle={mapScale.legendTitle}
            programGoal={goalProgram.goal}
          />
          <DataConfidenceCard program={goalProgram} features={visibleFeatures} />
          <AiInsightsCard
            programLabel={goalProgram.label}
            program={goalProgram}
            bandBreakdown={bandBreakdown}
            completion={stats.programCompletion}
            compliance={stats.compliance}
            features={visibleFeatures}
            onViewAssets={viewAssets}
          />
          {stats.programCompletion?.overviewChart !== OVERVIEW_CHART_TYPES.complianceSplit ? (
            <BandBreakdown breakdown={bandBreakdown} />
          ) : null}
          <section className="stats-section" aria-label="Program metrics">
            <div className="stats-metric-grid">
              {detailStats.map(([id, stat]) => (
                <AggregateStat key={id} stat={stat} />
              ))}
              <PortfolioComposition />
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
