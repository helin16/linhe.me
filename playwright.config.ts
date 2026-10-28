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
  reporter: process.env.CI ? [['github'], ['list']] : 'list', // CI failures show as annotations on the run
  use: { baseURL: `http://localhost:${previewPort}` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { // headless Firefox turns WebGL off on GPU-less machines (CI); turn it back on
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } } },
    },
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
