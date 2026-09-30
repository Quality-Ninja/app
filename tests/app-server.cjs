// Builds the app for the tests (API on 8766, the test Clerk instance) into test-dist/ and serves it on 8767.
const { execFileSync, spawn } = require('child_process');
const path = require('path');
const app = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  API_BASE_URL: 'http://127.0.0.1:8766',
  CLERK_PUBLISHABLE_KEY: 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk',
  CLERK_FRONTEND_API: 'https://test.clerk.accounts.dev',
  APP_ENV: 'test',
};
execFileSync(process.execPath, [path.join(app, 'build.js'), '--out=test-dist'], { env, stdio: 'inherit' });
const child = spawn(process.execPath, [path.join(app, 'serve.js'), '--dir=test-dist', '--host=127.0.0.1', '--port=8767'], { stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code || 0));
