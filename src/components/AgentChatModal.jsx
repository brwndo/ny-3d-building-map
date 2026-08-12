import { useEffect, useRef, useState } from 'react';
import { Plus, Send, Sparkles } from 'lucide-react';
import { useMapState } from '../context/MapStateContext';
import { GOAL_METRIC_KEYS, goalMetricMeta } from '../data/portfolioGoals';
import Modal from './Modal';

const SUGGESTIONS = [
  'Which assets are off track?',
  'Summarize LL97 exposure',
  'What should I send LPs this quarter?',
];

const BUILD_PROGRAM_PROMPT = 'Build a New Program';

function isBuildProgram(text) {
  const q = text.toLowerCase();
  return q.includes('new program') || (q.includes('build') && q.includes('program'));
}

function replyTo(text, { visibleCount, totalCount, programLabel }) {
  const q = text.toLowerCase();
  if (isBuildProgram(text)) {
    return `Let’s define a program for the ${visibleCount} assets in view. Name it, say what it’s for, and pick the metrics it should govern. I’ll switch the dashboard to Custom so you can set the targets.`;
  }
  if (q.includes('off track') || q.includes('at risk') || q.includes('risk')) {
    return `Under ${programLabel}, start with assets that are Off Track or At Risk in the current view (${visibleCount} of ${totalCount}). Open Filters to isolate those bands, then run the LL97 Quarterly Report or Energy Star Board Updates on just that set.`;
  }
  if (q.includes('ll97') || q.includes('exposure') || q.includes('penalty')) {
    return `LL97 exposure is a downstream report, not a GRESB input. Run “LL97 Quarterly Report” from Reports for penalty, covered square footage, and assets still short of the cap — scoped to the ${visibleCount} assets in view, or the full ${totalCount}-asset portfolio.`;
  }
  if (q.includes('lp') || q.includes('investor') || q.includes('quarter')) {
    return `For LPs this quarter, run “GRESB Investor Brief” or “Energy Star Board Updates” from Reports — scoped to assets in view if you are already filtered — then attach the active ${programLabel} snapshot.`;
  }
  if (q.includes('gresb')) {
    return `GRESB is an annual Standing Investments submission. “GRESB Investor Brief” is already on the Reports list — run it to refresh Management + Performance evidence. Readiness is separate from LL97 penalty math.`;
  }
  if (q.includes('energy star') || q.includes('benchmark') || q.includes('board')) {
    return `ENERGY STAR eligibility needs score ≥ 75 and a complete 12-month whole-building year. Run “Energy Star Board Updates” to see which assets clear both gates versus which only look strong on score.`;
  }
  if (q.includes('cover')) {
    return `Data coverage is the audit floor for this view. Assets below the program floor render grey until coverage recovers — keep that current before the next reporting window.`;
  }
  return `I can help find assets, interpret ${programLabel} for the ${visibleCount} buildings in view, point you at the right report, or build a new program. Try a suggestion below, or ask about off-track assets, LL97, or the LP package.`;
}

function ProgramBuilder({ onCreate }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(GOAL_METRIC_KEYS.map((key) => [key, true])),
  );

  const metricKeys = GOAL_METRIC_KEYS.filter((key) => selected[key]);
  const canCreate = name.trim() && metricKeys.length > 0;

  const toggle = (key) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <form
      className="agent-program-builder"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canCreate) return;
        onCreate({
          name: name.trim(),
          purpose: purpose.trim(),
          metricKeys,
        });
      }}
    >
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
      <fieldset className="reports-field">
        <legend>Metrics to govern</legend>
        {GOAL_METRIC_KEYS.map((key) => (
          <label key={key} className="reports-radio">
            <input
              type="checkbox"
              checked={Boolean(selected[key])}
              onChange={() => toggle(key)}
            />
            <span>{goalMetricMeta(key)?.label ?? key}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="goals-primary-btn" disabled={!canCreate}>
        Create program
      </button>
    </form>
  );
}

export default function AgentChatModal({ open, onClose }) {
  const { features, visibleFeatures, goalProgram, setGoalProgram } = useMapState();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'agent',
      text: 'Ask about the portfolio in view — off-track assets, reporting packs, LP packages, or build a new program.',
    },
  ]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [programBuilt, setProgramBuilt] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const pendingTimer = useRef(null);

  const ctx = {
    visibleCount: visibleFeatures.length,
    totalCount: features.length,
    programLabel: goalProgram.label,
  };

  const builderOpen = messages.some((m) => m.form === 'build-program' && !m.formDone);
  const showStarters = messages.length < 3 && !pending;
  const showBuild = !builderOpen && !programBuilt && !pending;

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    return () => {
      if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    };
  }, []);

  const send = (raw) => {
    const text = raw.trim();
    if (!text || pending) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setPending(true);
    pendingTimer.current = window.setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'agent',
          text: replyTo(text, ctx),
          form: isBuildProgram(text) && !programBuilt ? 'build-program' : undefined,
        },
      ]);
      setPending(false);
    }, 650);
  };

  const handleCreateProgram = (draftProgram) => {
    setGoalProgram('custom');
    setProgramBuilt(true);
    const metricLabels = draftProgram.metricKeys
      .map((key) => goalMetricMeta(key)?.label ?? key)
      .join(', ');
    setMessages((prev) => [
      ...prev.map((m) => (m.form === 'build-program' ? { ...m, formDone: true } : m)),
      {
        id: `a-${Date.now()}`,
        role: 'agent',
        text: `Created “${draftProgram.name}” covering ${metricLabels}. I switched the dashboard to Custom so you can set the targets in the stats panel.${
          draftProgram.purpose ? ` Purpose: ${draftProgram.purpose}` : ''
        }`,
      },
    ]);
  };

  const handleClose = () => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
    setPending(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Agent"
      subtitle="Prototype assistant for the assets currently in view."
      panelClassName="app-modal-panel--chat"
      headerActions={
        <span className="agent-chat-badge" aria-hidden="true">
          <Sparkles />
        </span>
      }
    >
      <div className="agent-chat-body">
        <div className="agent-chat-messages" ref={listRef} tabIndex={0}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={`agent-chat-bubble agent-chat-bubble--${m.role}`}
            >
              {m.role === 'agent' && (
                <Sparkles className="agent-chat-bubble-icon" aria-hidden="true" />
              )}
              <div className="agent-chat-bubble-stack">
                <p>{m.text}</p>
                {m.form === 'build-program' && !m.formDone && (
                  <ProgramBuilder onCreate={handleCreateProgram} />
                )}
              </div>
            </div>
          ))}
          {pending && (
            <div className="agent-chat-bubble agent-chat-bubble--agent" aria-live="polite">
              <Sparkles className="agent-chat-bubble-icon" aria-hidden="true" />
              <div className="agent-chat-bubble-stack">
                <p className="agent-chat-pending">Thinking…</p>
              </div>
            </div>
          )}
        </div>

        {(showStarters || showBuild) && (
          <div className="agent-chat-suggestions">
            {showStarters &&
              SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="agent-chat-suggestion"
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            {showBuild && (
              <button
                type="button"
                className="agent-chat-suggestion agent-chat-suggestion--action"
                onClick={() => send(BUILD_PROGRAM_PROMPT)}
              >
                <Plus aria-hidden="true" />
                Build a New Program
              </button>
            )}
          </div>
        )}

        <form
          className="agent-chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <label className="visually-hidden" htmlFor="agent-chat-input">
            Message the agent
          </label>
          <input
            id="agent-chat-input"
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about the portfolio…"
            autoComplete="off"
            disabled={pending}
          />
          <button
            type="submit"
            className="agent-chat-send"
            aria-label="Send message"
            disabled={pending || !draft.trim()}
          >
            <Send aria-hidden="true" />
          </button>
        </form>
      </div>
    </Modal>
  );
}
