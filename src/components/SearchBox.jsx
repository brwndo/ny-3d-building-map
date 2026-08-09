import { useMemo, useState } from 'react';
import { useMapState } from '../context/MapStateContext';
import { searchMatches } from '../data/filters';

const MAX_RESULTS = 8;

export default function SearchBox() {
  const { features, setSelectedId, setFlyToRequest } = useMapState();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return features.filter((f) => searchMatches(f.properties, query)).slice(0, MAX_RESULTS);
  }, [features, query]);

  const select = (feature) => {
    setSelectedId(feature.properties.id);
    setFlyToRequest({ coords: feature.geometry.coordinates, ts: Date.now() });
    setQuery('');
  };

  return (
    <div className="search-box">
      <input
        type="search"
        placeholder="Search name, address, or Asset ID…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length > 0) select(results[0]);
        }}
      />
      {focused && query.trim() && (
        <div className="search-results">
          {results.length === 0 && <div className="search-empty">No matches</div>}
          {results.map((f) => (
            <button key={f.properties.id} className="search-result" onClick={() => select(f)}>
              <span className="search-result-name">{f.properties.name}</span>
              <span className="search-result-sub">
                {f.properties.id} · {f.properties.address}, {f.properties.city}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
