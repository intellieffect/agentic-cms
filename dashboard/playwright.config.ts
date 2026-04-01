import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3003',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  retries: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  webServer: {
    command: 'PORT=3003 npm run dev',
    port: 3003,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
