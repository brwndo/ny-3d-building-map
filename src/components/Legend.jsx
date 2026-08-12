import { useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { bandCss, GREY } from '../data/colorScale';
import { confidenceCoveragePct, mapScaleFor, uncoveredAssetCount } from '../data/goalPrograms';

export default function Legend() {
  const { goalProgram, programContext, visibleFeatures, confidenceGreyEnabled } = useMapState();
  const [collapsed, setCollapsed] = useState(false);

  const mapScale = mapScaleFor(goalProgram);
  const uncovered = uncoveredAssetCount(visibleFeatures, goalProgram, programContext);

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
            <div className="legend-title">{goalProgram.label}</div>
            {mapScale.bands.map((band) => (
              <div key={band.key} className="legend-row">
                <span className="legend-swatch" style={{ background: bandCss(band.key) }} />
                <span>
                  {band.key}
                  {band.meaning ? (
                    <span className="legend-meaning"> — {band.meaning}</span>
                  ) : null}
                </span>
              </div>
            ))}
            {uncovered > 0 && (
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: `rgb(${GREY.join(',')})` }} />
                <span>Not covered by this program ({uncovered})</span>
              </div>
            )}
            {confidenceGreyEnabled ? (
              <div className="legend-row">
                <span className="legend-swatch" style={{ background: `rgb(${GREY.join(',')})` }} />
                <span>Below {confidenceCoveragePct(goalProgram)}% data coverage</span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
