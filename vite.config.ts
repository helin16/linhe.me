import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  // the game chunk is ~535 kB, nearly all three.js; it only loads on the game page
  build: { chunkSizeWarningLimit: 600 },
});
