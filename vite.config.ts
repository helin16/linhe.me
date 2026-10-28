import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { DEFAULTS } from './relay/config.ts';

// `yarn dev` / `yarn preview` pass /relay to a local relay (`yarn relay`), like Caddy does in production
const relay = { '/relay': { target: `http://127.0.0.1:${process.env.RELAY_PORT ?? DEFAULTS.port}`, ws: true } };

export default defineConfig({
  base: '/',
  plugins: [react()],
  // the game chunk is ~535 kB, nearly all three.js; it only loads on the game page
  build: { chunkSizeWarningLimit: 600 },
  server: { proxy: relay },
  preview: { proxy: relay },
});
