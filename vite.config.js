import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/ny-3d-building-map/' : '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
});
