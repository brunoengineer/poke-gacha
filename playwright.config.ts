// Browser tests: they play the real game on a desktop and a phone screen. `npm run e2e` (see e2e/helpers.ts).

import { defineConfig } from '@playwright/test';

const CI = !!process.env.CI;
const PORT = 5199;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // GitHub's machine has 4 CPU threads: 3 workers beat the default of 2 there, and 4 is no faster. Elsewhere, the default.
  workers: CI ? 3 : undefined,
  timeout: 90_000,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    // Guest mode only: tests must never touch the real Firebase project, even with a local .env.local.
    env: { VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_AUTH_DOMAIN: '', VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_APP_ID: '' },
  },
});
