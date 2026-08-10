import { useMapState } from '../context/MapStateContext';
import { METRICS } from '../data/colorScale';
import { formatCompletion, formatTargetsMet } from '../data/goalPrograms';

export default function HoverPopup({ info }) {
  const { goalProgram, scoreFor } = useMapState();
  const props = info.object.properties;
  const score = scoreFor(props);

  // Name what is holding the asset back rather than just how far back it is.
  const missing = score.metrics
    .filter((m) => !m.met)
    .sort((a, b) => a.p - b.p)
    .slice(0, 2)
    .map((m) => METRICS.find((entry) => entry.key === m.key)?.label ?? m.key);

  return (
    <div className="hover-popup" style={{ left: info.x + 12, top: info.y + 12 }}>
      <div className="hover-name">{props.name}</div>
      <div>{props.address}, {props.city}</div>
      <div>{goalProgram.label}</div>
      <div>
        <strong>{formatCompletion(score)}</strong>
        {score.band ? ` · ${score.band}` : ''}
      </div>
      {score.covered && <div>{formatTargetsMet(score)}</div>}
      {missing.length > 0 && <div>Short on: {missing.join(', ')}</div>}
      <div>
        Confidence: <strong>{props.confidenceTier}</strong>
      </div>
    </div>
  );
}
