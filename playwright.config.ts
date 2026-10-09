import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const remote = !/localhost|127\.0\.0\.1/.test(baseURL)

// Locally the dev servers are started by the developer (`pnpm dev:all`); no webServer here.
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: remote ? 180_000 : 90_000,
  expect: { timeout: remote ? 30_000 : 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Serverless cold start + Neon waking from auto-suspend can slow the first request.
    navigationTimeout: remote ? 90_000 : 30_000,
    actionTimeout: remote ? 30_000 : 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
