const { defineConfig } = require('@playwright/test');
// The app is built for tests and served on 8767; the API's browser-test server runs on 8766 from the sibling api/ folder.
module.exports = defineConfig({
  testDir: './tests', timeout: 30000, workers: 1,
  use: { headless: true, viewport: { width: 1000, height: 800 },
    launchOptions: process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {} },
  webServer: [
    { command: 'node tests/api-server.cjs', url: 'http://127.0.0.1:8766/healthz', reuseExistingServer: false },
    { command: 'node tests/app-server.cjs', url: 'http://127.0.0.1:8767/sign-in', reuseExistingServer: false },
  ],
});
