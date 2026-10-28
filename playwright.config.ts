import { defineConfig, devices } from '@playwright/test';
import { DEFAULTS } from './relay/config.ts';

// Browser end-to-end tests against the production build (`yarn preview`) and a local relay (`yarn relay`).
const previewPort = Number(process.env.PREVIEW_PORT ?? 4173); // vite preview's default port
const relayPort = Number(process.env.RELAY_PORT ?? DEFAULTS.port);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1, // the online specs share one relay and one preview server
  timeout: 60_000,
  use: { baseURL: `http://localhost:${previewPort}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-ipad', use: { ...devices['iPad (gen 7)'] } }, // Safari engine with touch
  ],
  // always fresh servers: the deploy must test the build it ships, never a stale one left running
  webServer: [
    { command: 'yarn relay', port: relayPort, reuseExistingServer: false },
    {
      command: `yarn build && yarn preview --port ${previewPort} --strictPort`,
      port: previewPort, reuseExistingServer: false, timeout: 120_000,
    },
  ],
});
