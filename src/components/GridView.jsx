import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { bandCss, GREY } from '../data/colorScale';
import { layoutAssetCircles } from '../data/circlePackLayout';
import HoverPopup from './HoverPopup';

function tileColor(props, isGreyed, bandFor) {
  if (isGreyed(props)) return `rgb(${GREY.join(', ')})`;
  return bandCss(bandFor(props));
}

function formatSqFt(value) {
  if (value == null || !Number.isFinite(value)) return '';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M ft²`;
  if (value >= 10_000) return `${Math.round(value / 1000)}k ft²`;
  return `${Math.round(value).toLocaleString()} ft²`;
}

export default function GridView() {
  const {
    visibleFeatures,
    bandFor,
    isGreyed,
    isMetricDimmed,
    selectedId,
    setSelectedId,
    focusAssetId,
  } = useMapState();

  const [hoverInfo, setHoverInfo] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const nodes = useMemo(() => {
    if (size.width < 40 || size.height < 40) return [];
    return layoutAssetCircles(visibleFeatures, size.width, size.height);
  }, [visibleFeatures, size.width, size.height]);

  useEffect(() => {
    if (!focusAssetId?.id) return;
    const el = document.getElementById(`grid-tile-${focusAssetId.id}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.classList.add('grid-bubble--pulse');
    const timer = window.setTimeout(() => el?.classList.remove('grid-bubble--pulse'), 600);
    return () => window.clearTimeout(timer);
  }, [focusAssetId]);

  const setHoverFromEvent = (feature, e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoverInfo({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      object: feature,
    });
  };

  return (
    <div className="grid-view" ref={containerRef}>
      <div className="grid-view-pack" aria-label="Bubble chart of assets sized by floor area">
        {nodes.map((node) => {
          const props = node.feature.properties;
          const selected = node.id === selectedId;
          const dimmed = isMetricDimmed(props);
          const showLabel = node.r >= 34;
          return (
            <div
              key={node.id}
              id={`grid-tile-${node.id}`}
              role="button"
              tabIndex={0}
              className={`grid-bubble${selected ? ' grid-bubble--selected' : ''}${dimmed ? ' grid-bubble--dimmed' : ''}`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                backgroundColor: tileColor(props, isGreyed, bandFor),
              }}
              aria-label={`${props.name}, ${formatSqFt(props.floorArea)}`}
              aria-pressed={selected}
              onClick={() => setSelectedId(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedId(node.id);
                }
              }}
              onMouseEnter={(e) => setHoverFromEvent(node.feature, e)}
              onMouseMove={(e) => setHoverFromEvent(node.feature, e)}
              onMouseLeave={() => setHoverInfo(null)}
            >
              {showLabel && (
                <span className="grid-bubble-label">
                  <span className="grid-bubble-name">{props.name}</span>
                  <span className="grid-bubble-meta">{formatSqFt(props.floorArea)}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid-view-caption">Bubble area ∝ floor area</div>
      {hoverInfo && <HoverPopup info={hoverInfo} />}
    </div>
  );
}
