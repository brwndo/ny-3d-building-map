import { useEffect, useState } from 'react';
import { MapStateProvider } from './context/MapStateContext';
import MapView from './components/MapView';
import FilterPanel from './components/FilterPanel';
import SearchBox from './components/SearchBox';
import Legend from './components/Legend';
import DetailPanel from './components/DetailPanel';
import EmptyStateOverlay from './components/EmptyStateOverlay';

export default function App() {
  const [buildings, setBuildings] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/data/buildings.geojson').then((r) => r.json()),
      fetch('/data/ny-state-boundary.geojson').then((r) => r.json()),
    ])
      .then(([b, n]) => {
        setBuildings(b);
        setBoundary(n);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) {
    return (
      <div className="load-screen">
        Failed to load data: {error}. Run <code>scripts/prepare_data.py</code> first.
      </div>
    );
  }
  if (!buildings || !boundary) {
    return <div className="load-screen">Loading portfolio…</div>;
  }

  return (
    <MapStateProvider buildings={buildings} boundary={boundary}>
      <div className="app-layout">
        <MapView />
        <FilterPanel />
        <SearchBox />
        <Legend />
        <DetailPanel />
        <EmptyStateOverlay />
      </div>
    </MapStateProvider>
  );
}
