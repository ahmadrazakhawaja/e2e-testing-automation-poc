import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`
const isCI = !!process.env.CI

// Tests run against a separate SQLite file whose demo data is re-seeded on every run.
// Absolute path so the built server resolves it no matter where it is started from.
const e2eDatabaseUrl = `file:${fileURLToPath(new URL('./prisma/e2e.db', import.meta.url))}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Uncomment after `npx playwright install firefox webkit` for cross-browser runs.
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Skipped when E2E_BASE_URL points at an already-deployed environment.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run db:setup && npm run build && npm start',
        url: `${baseURL}/api/auth/me`,
        timeout: 180_000,
        reuseExistingServer: !isCI,
        stdout: 'ignore',
        stderr: 'pipe',
        env: { DATABASE_URL: e2eDatabaseUrl, PORT: String(PORT) },
      },
})
