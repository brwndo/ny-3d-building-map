import { bandCss } from '../data/colorScale';
import { fmtMetricValue } from '../data/format';
import { bandForProgress } from '../data/goalPrograms';

/**
 * Compact share-vs-required bar for thresholdShare metrics.
 * Percentage targets use a 0–100% track with the required tick at the true
 * target (e.g. 75%). Other units still fill toward the required value.
 */
export default function ShareVsRequiredBar({
  current,
  target,
  unit = '%',
  label = null,
  showLegend = true,
}) {
  if (
    current == null ||
    target == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(target)
  ) {
    return null;
  }

  const progress =
    target === 0 ? (current <= 0 ? 1 : 0) : Math.min(1, Math.max(0, current / target));
  const isPercent = unit === '%';
  const fillWidth = isPercent ? Math.min(1, Math.max(0, current)) : progress;
  const tickAt = isPercent ? Math.min(1, Math.max(0, target)) : 1;
  const met = progress >= 1 - 1e-9;
  const fillBand = met ? 'Target Met' : bandForProgress(progress);

  return (
    <div
      className="share-vs-required"
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${fmtMetricValue(current, unit)} of ${fmtMetricValue(target, unit)} required`}
    >
      {label ? (
        <div className="share-vs-required-head">
          <span className="share-vs-required-label">{label}</span>
          <span className="share-vs-required-values">
            {fmtMetricValue(current, unit)}
            <span className="share-vs-required-target">
              {' '}
              / {fmtMetricValue(target, unit)}
            </span>
          </span>
        </div>
      ) : (
        <div className="share-vs-required-values share-vs-required-values--solo">
          {fmtMetricValue(current, unit)}
          <span className="share-vs-required-target">
            {' '}
            / {fmtMetricValue(target, unit)} required
          </span>
        </div>
      )}
      <div className="share-vs-required-track">
        <div
          className="share-vs-required-fill"
          style={{
            width: `${fillWidth * 100}%`,
            background: bandCss(fillBand),
          }}
        />
        <span
          className="share-vs-required-tick"
          style={{ left: `${tickAt * 100}%` }}
          title={`Required ${fmtMetricValue(target, unit)}`}
        />
      </div>
      {showLegend ? (
        <div className="share-vs-required-legend">
          <span>
            <i
              className="share-vs-required-swatch share-vs-required-swatch--fill"
              style={{ background: bandCss(fillBand) }}
            />
            Current
          </span>
          <span>
            <i className="share-vs-required-swatch share-vs-required-swatch--tick" />
            Required bar
          </span>
        </div>
      ) : null}
    </div>
  );
}
