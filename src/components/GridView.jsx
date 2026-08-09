import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { bandCss, GREY } from '../data/colorScale';
import HoverPopup from './HoverPopup';

function tileColor(props, metricKey, isGreyed) {
  if (isGreyed(props)) return `rgb(${GREY.join(', ')})`;
  return bandCss(props.metrics?.[metricKey]?.band);
}

export default function GridView() {
  const {
    visibleFeatures,
    metricKey,
    isGreyed,
    selectedId,
    setSelectedId,
    focusAssetId,
  } = useMapState();

  const [hoverInfo, setHoverInfo] = useState(null);
  const containerRef = useRef(null);

  const sortedFeatures = useMemo(
    () => [...visibleFeatures].sort((a, b) => a.properties.id.localeCompare(b.properties.id)),
    [visibleFeatures]
  );

  useEffect(() => {
    if (!focusAssetId?.id) return;
    const el = document.getElementById(`grid-tile-${focusAssetId.id}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.classList.add('grid-tile--pulse');
    const timer = window.setTimeout(() => el?.classList.remove('grid-tile--pulse'), 600);
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
      <div className="grid-view-inner">
        {sortedFeatures.map((feature) => {
          const { id } = feature.properties;
          const selected = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              id={`grid-tile-${id}`}
              className={`grid-tile${selected ? ' grid-tile--selected' : ''}`}
              style={{ backgroundColor: tileColor(feature.properties, metricKey, isGreyed) }}
              aria-label={feature.properties.name}
              aria-pressed={selected}
              onClick={() => setSelectedId(id)}
              onMouseEnter={(e) => setHoverFromEvent(feature, e)}
              onMouseMove={(e) => setHoverFromEvent(feature, e)}
              onMouseLeave={() => setHoverInfo(null)}
            />
          );
        })}
      </div>
      {hoverInfo && <HoverPopup info={hoverInfo} />}
    </div>
  );
}
