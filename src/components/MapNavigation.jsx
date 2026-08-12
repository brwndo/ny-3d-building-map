import MapCompass from './MapCompass';

export default function MapNavigation({
  bearing,
  onResetNorth,
  onZoomIn,
  onZoomOut,
  showCompass = true,
}) {
  return (
    <div className="map-navigation">
      <div className="map-zoom-controls">
        <button
          type="button"
          className="map-zoom-button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="map-zoom-button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          −
        </button>
      </div>
      {showCompass ? <MapCompass bearing={bearing} onResetNorth={onResetNorth} /> : null}
    </div>
  );
}
