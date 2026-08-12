import { useEffect, useState } from 'react';
import { MapStateProvider } from './context/MapStateContext';
import AppShell from './components/AppShell';

export default function App() {
  const [buildings, setBuildings] = useState(null);
  const [boundary, setBoundary] = useState(null);
  const [counties, setCounties] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const dataBase = `${import.meta.env.BASE_URL}data`;
    Promise.all([
      fetch(`${dataBase}/buildings.geojson`).then((r) => r.json()),
      fetch(`${dataBase}/ny-state-boundary.geojson`).then((r) => r.json()),
      fetch(`${dataBase}/ny-counties.geojson`).then((r) => r.json()),
    ])
      .then(([b, n, c]) => {
        setBuildings(b);
        setBoundary(n);
        setCounties(c);
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
  if (!buildings || !boundary || !counties) {
    return <div className="load-screen">Loading portfolio…</div>;
  }

  return (
    <MapStateProvider buildings={buildings} boundary={boundary} counties={counties}>
      <AppShell />
    </MapStateProvider>
  );
}
