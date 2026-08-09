import { useMapState } from '../context/MapStateContext';
import { BANDS, GREY, METRICS } from '../data/colorScale';

export default function Legend() {
  const { metricKey } = useMapState();
  const metric = METRICS.find((m) => m.key === metricKey);

  return (
    <div className="legend">
      <div className="legend-title">{metric.label}</div>
      {[...BANDS].reverse().map((band) => (
        <div key={band.key} className="legend-row">
          <span
            className="legend-swatch"
            style={{ background: `rgb(${band.color.join(',')})` }}
          />
          <span>{band.key}</span>
        </div>
      ))}
      <div className="legend-row">
        <span className="legend-swatch" style={{ background: `rgb(${GREY.join(',')})` }} />
        <span>Below confidence threshold</span>
      </div>
      <div className="legend-note">Column height = number of floors</div>
    </div>
  );
}
