import { useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { BANDS, GREY, METRICS } from '../data/colorScale';

export default function Legend() {
  const { metricKey } = useMapState();
  const [collapsed, setCollapsed] = useState(false);
  const metric = METRICS.find((m) => m.key === metricKey);

  return (
    <div className={`map-legend${collapsed ? ' map-legend--collapsed' : ''}`}>
      <button
        type="button"
        className="map-legend-toggle"
        onClick={() => setCollapsed((open) => !open)}
        aria-expanded={!collapsed}
        aria-controls="map-legend-body"
      >
        <span>Legend</span>
        <span className="map-legend-chevron" aria-hidden>
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && (
        <div className="legend-body" id="map-legend-body">
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
          </div>
        </div>
      )}
    </div>
  );
}
