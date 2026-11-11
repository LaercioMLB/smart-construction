import { defineConfig } from '@playwright/test';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve('.cache/ms-playwright');
const baseURL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3011';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: 'npm run dev -- --port 3011',
        url: baseURL,
        reuseExistingServer: false,
      },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  ],
});
