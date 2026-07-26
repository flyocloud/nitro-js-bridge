import { defineConfig, devices } from '@playwright/test';

/**
 * The bridge lives in other people's websites, so the parts that must not break
 * them (no host mutation, no layout impact, immunity to site CSS) are verified
 * in real Chromium, Firefox and WebKit — not against a DOM stub.
 *
 * `npm run test:e2e` — needs the browsers once: `npx playwright install`.
 */
/** Override with PLAYWRIGHT_PORT when 5174 is taken by your own dev server. */
const PORT = Number(process.env.PLAYWRIGHT_PORT || 5174);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Real mouse timing in CI containers is not perfectly reproducible.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    // Locally, reuse the dev server you already have open.
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
});
