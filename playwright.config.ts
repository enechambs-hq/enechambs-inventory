/**
 * Browser end-to-end suite (customer journey and staff/admin screens).
 *
 * It drives the REAL frontend (production build) against the REAL backend and
 * PostgreSQL, with a SCRIPTED payment provider and a fake mailer: it never
 * contacts Flutterwave or Resend and never moves money. The backend side is the
 * `e2e:server` script of enechambs-api, which refuses anything but a
 * disposable local test database. See docs/E2E_TESTS.md.
 *
 *   E2E_BACKEND_DIR=../enechambs-api \
 *   TEST_DATABASE_URL=postgres://u:p@127.0.0.1:5432/enechambs_e2e_test \
 *     npm run test:e2e
 */
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 4312);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4310);
const CONTROL_PORT = Number(process.env.E2E_CONTROL_PORT ?? 4311);
const BACKEND_DIR = path.resolve(process.env.E2E_BACKEND_DIR ?? path.join(__dirname, '..', 'enechambs-api'));
/**
 * A fake value shared with the backend's test environment (test/storefront/
 * support/env.ts). It signs nothing real: the e2e backend and this frontend are
 * both throwaway test processes.
 */
const TEST_BFF_SECRET = process.env.E2E_BFF_SHARED_SECRET ?? 'test-bff-shared-secret-0123456789abcdef';

export default defineConfig({
  testDir: './e2e',
  // One database, state-changing journeys: run serially.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The real API on a disposable database, with the scripted provider and control surface.
      command: 'npm run e2e:server',
      cwd: BACKEND_DIR,
      url: `http://127.0.0.1:${CONTROL_PORT}/health`,
      env: {
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? process.env.E2E_DATABASE_URL ?? '',
        E2E_API_PORT: String(API_PORT),
        E2E_CONTROL_PORT: String(CONTROL_PORT),
      },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'pipe',
    },
    {
      // The production build of this app; the staff client calls the same-origin /api/v1 proxy.
      command: `npm run build && npx next start -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/combos`,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${WEB_PORT}/api/v1`,
        BACKEND_URL: `http://127.0.0.1:${API_PORT}`,
        STOREFRONT_ENABLED: 'true',
        BFF_SHARED_SECRET: TEST_BFF_SECRET,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 480_000,
      stdout: 'pipe',
    },
  ],
});
