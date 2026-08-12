import React from 'react';
import ReactDOM from 'react-dom/client';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import '@fontsource/geist-sans/300.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-mono/400.css';
import '@fontsource/geist-mono/600.css';
import App from './App';
import './styles.css';

// Production builds rewrite maplibre into a hashed chunk; without an explicit
// worker URL, MapLibre looks for sibling maplibre-gl-worker.mjs and 404s on
// GitHub Pages (no vector tiles / basemap labels). Vite ?worker&url emits a
// self-contained worker that includes maplibre-gl-shared.
setWorkerUrl(maplibreWorkerUrl);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
