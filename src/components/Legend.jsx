import { useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { BANDS, GREY, METRICS } from '../data/colorScale';
import { uncoveredAssetCount } from '../data/goalPrograms';

const BAND_MEANING = {
  'Target Met': 'every target met',
  'On Track': '75%+ complete',
  'At Risk': '40%+ complete',
  'Off Track': 'under 40% complete',
};

export default function Legend() {
  const { goalProgram, governedMetrics, programContext, visibleFeatures } = useMapState();
  const [collapsed, setCollapsed] = useState(false);

  const targetNames = useMemo(
    () =>
      METRICS.filter((m) => governedMetrics.includes(m.key))
        .map((m) => m.label)
        .join(', '),
    [governedMetrics]
  );
  const uncovered = uncoveredAssetCount(visibleFeatures, goalProgram, programContext);
  const targetCount = governedMetrics.length;

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
            <div className="legend-title">
              Completion toward {targetCount === 1 ? 'the target' : `all ${targetCount} targets`}
            </div>
            <div className="legend-program">{goalProgram.label}</div>
            <div className="legend-purpose">{targetNames}</div>
            {[...BANDS].reverse().map((band) => (
              <div key={band.key} className="legend-row">
                <span
                  className="legend-swatch"
                  style={{ background: `rgb(${band.color.join(',')})` }}
                />
                <span>
                  {band.key}
                  <span className="legend-meaning"> — {BAND_MEANING[band.key]}</span>
                </span>
              </div>
            ))}
            {uncovered > 0 && (
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: `rgb(${GREY.join(',')})` }} />
                <span>Not covered by this program ({uncovered})</span>
              </div>
            )}
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
