import { useMapState } from '../context/MapStateContext';

export default function EmptyStateOverlay() {
  const { visibleFeatures, resetFilters } = useMapState();
  if (visibleFeatures.length > 0) return null;

  return (
    <div className="empty-overlay">
      <div className="empty-card">
        <div className="empty-title">No buildings match your filters</div>
        <p>
          Separate fields must all match, so narrow selections combine quickly. Loosen a
          field under Portfolio Filters or Show only bands, or reset.
        </p>
        <button onClick={resetFilters}>Reset filters</button>
      </div>
    </div>
  );
}
