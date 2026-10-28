import { defineConfig } from 'vite';

// Bundles the relay (and ws) into one file the server runs with plain `node`; see specs/003-online-relay.
export default defineConfig({
  build: {
    ssr: 'relay/server.ts',
    outDir: 'dist-relay',
    target: 'node24',
    emptyOutDir: true,
    rolldownOptions: {
      external: ['bufferutil', 'utf-8-validate'], // optional native add-ons ws loads if present
      output: { entryFileNames: 'relay.mjs', format: 'es' },
    },
  },
  ssr: { noExternal: true },
});
