export default function MapCompass({ bearing, onResetNorth }) {
  return (
    <button
      type="button"
      className="map-compass"
      onClick={onResetNorth}
      aria-label="Reset map to north"
      title="Reset to north"
    >
      <span className="map-compass-dial" style={{ transform: `rotate(${-bearing}deg)` }}>
        <span className="map-compass-n" aria-hidden="true">
          N
        </span>
        <span className="map-compass-needle" aria-hidden="true" />
      </span>
    </button>
  );
}
