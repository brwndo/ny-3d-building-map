import { useMapState } from '../context/MapStateContext';
import { METRICS } from '../data/colorScale';
import { fmtMetricValue } from '../data/format';

export default function HoverPopup({ info }) {
  const { metricKey } = useMapState();
  const props = info.object.properties;
  const metric = props.metrics[metricKey];
  const metricLabel = METRICS.find((m) => m.key === metricKey).label;

  return (
    <div className="hover-popup" style={{ left: info.x + 12, top: info.y + 12 }}>
      <div className="hover-name">{props.name}</div>
      <div>{props.address}, {props.city}</div>
      <div>
        {metricLabel}: <strong>{fmtMetricValue(metric.currentValue, metric.unit)}</strong>
      </div>
      <div>
        Confidence: <strong>{props.confidenceTier}</strong>
      </div>
    </div>
  );
}
