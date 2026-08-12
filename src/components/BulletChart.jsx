import { bandCss } from '../data/colorScale';
import { fmtMetricValue } from '../data/format';
import Tooltip from './Tooltip';

function valueAtProgress(baseline, target, direction, p) {
  const lowerIsBetter = direction === 'Lower is better';
  const span = lowerIsBetter ? baseline - target : target - baseline;
  if (Math.abs(span) < 1e-12) return target;
  return lowerIsBetter ? baseline - p * span : baseline + p * span;
}

/**
 * Compact bullet chart: current measure bar, target tick, and an optional
 * expected-pace tick on a neutral track. Scale spans baseline → target and
 * expands to include the current value when it overshoots. Values appear on
 * hover of the associated bar/marker.
 */
export default function BulletChart({
  current,
  baseline,
  target,
  expectedP = null,
  direction = 'Higher is better',
  unit,
  band = null,
}) {
  if (
    current == null ||
    baseline == null ||
    target == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(baseline) ||
    !Number.isFinite(target)
  ) {
    return null;
  }

  const expectedValue =
    expectedP != null && Number.isFinite(expectedP)
      ? valueAtProgress(baseline, target, direction, expectedP)
      : null;

  const points = [baseline, current, target];
  if (expectedValue != null) points.push(expectedValue);

  let domainMin = Math.min(...points);
  let domainMax = Math.max(...points);
  if (domainMax - domainMin < 1e-12) {
    domainMin -= Math.abs(domainMin) * 0.05 + 1;
    domainMax += Math.abs(domainMax) * 0.05 + 1;
  } else {
    const pad = (domainMax - domainMin) * 0.08;
    domainMin -= pad;
    domainMax += pad;
  }

  const span = domainMax - domainMin;
  const xOf = (v) => ((v - domainMin) / span) * 100;

  const baselineX = xOf(baseline);
  const currentX = xOf(current);
  const targetX = xOf(target);
  const barLeft = Math.min(baselineX, currentX);
  const barWidth = Math.abs(currentX - baselineX);
  const measureColor = band ? bandCss(band) : '#1e40af';

  const currentLabel = `Current ${fmtMetricValue(current, unit)}`;
  const targetLabel = `Target ${fmtMetricValue(target, unit)}`;
  const expectedLabel =
    expectedValue != null
      ? `Expected pace ${fmtMetricValue(expectedValue, unit)}`
      : null;

  const label = [
    currentLabel,
    targetLabel,
    `baseline ${fmtMetricValue(baseline, unit)}`,
  ].join(', ');

  return (
    <div className="bullet-chart" aria-label={label}>
      <div className="bullet-chart-track">
        <Tooltip label={currentLabel} content={currentLabel}>
          <button
            type="button"
            className="bullet-chart-measure"
            style={{
              left: `${barLeft}%`,
              width: `${Math.max(barWidth, 0.6)}%`,
              background: measureColor,
            }}
            aria-label={currentLabel}
          />
        </Tooltip>
        <Tooltip label={targetLabel} content={targetLabel}>
          <button
            type="button"
            className="bullet-chart-marker bullet-chart-marker--target"
            style={{ left: `${targetX}%` }}
            aria-label={targetLabel}
          />
        </Tooltip>
        {expectedValue != null ? (
          <Tooltip label={expectedLabel} content={expectedLabel}>
            <button
              type="button"
              className="bullet-chart-marker bullet-chart-marker--expected"
              style={{ left: `${xOf(expectedValue)}%` }}
              aria-label={expectedLabel}
            />
          </Tooltip>
        ) : null}
      </div>
      <div className="bullet-chart-legend">
        <span>
          <i
            className="bullet-chart-swatch bullet-chart-swatch--measure"
            style={{ background: measureColor }}
          />
          Current
        </span>
        <span>
          <i className="bullet-chart-swatch bullet-chart-swatch--target" />
          Target
        </span>
        {expectedValue != null ? (
          <span>
            <i className="bullet-chart-swatch bullet-chart-swatch--expected" />
            Expected pace
          </span>
        ) : null}
      </div>
    </div>
  );
}
