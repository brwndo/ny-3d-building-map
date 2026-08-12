import { useMemo } from 'react';
import { useMapState } from '../context/MapStateContext';
import { computeLeedInventory } from '../data/certs';
import { governsMetric } from '../data/goalPrograms';

/**
 * What the portfolio in view is made of, credential-wise. Only shown when the
 * active program grades certifications (GRESB). Deliberately not a goal tile:
 * a LEED level is a category, so there is no target to progress toward.
 */
export default function PortfolioComposition() {
  const { visibleFeatures, goalProgram } = useMapState();
  const leed = useMemo(() => computeLeedInventory(visibleFeatures), [visibleFeatures]);

  if (!governsMetric(goalProgram, 'certifications')) return null;
  if (leed.totalAssets === 0) return null;

  return (
    <div className="aggregate-stat">
      <div className="aggregate-stat-top">
        <span className="aggregate-stat-label">LEED credentials</span>
      </div>
      <span className="aggregate-stat-value">
        {leed.leedCount} of {leed.totalAssets} assets
      </span>
      {leed.leedCount > 0 ? (
        <>
          <span className="aggregate-stat-goal">
            BD+C {leed.bdcCount} · O+M {leed.omCount}
          </span>
          <div className="composition-levels">
            {leed.levelBreakdown.map(({ level, count }) => (
              <div key={level} className="composition-level-row">
                <span>{level}</span>
                <span>{count}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <span className="aggregate-stat-hint">
        Portfolio composition · certification levels are categories, not targets
      </span>
    </div>
  );
}
