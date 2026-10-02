const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const app = 'http://127.0.0.1:8767';
const api = 'http://127.0.0.1:8766';
const clerkScript = fs.readFileSync(path.join(__dirname, 'clerk-web-double.js'), 'utf8');

test.beforeEach(async ({ page, request }) => {
  await request.post(api + '/_test/reset');
  await page.route('https://test.clerk.accounts.dev/**', route => route.fulfill({ contentType: 'application/javascript', body: route.request().url().includes('clerk.browser.js') ? clerkScript : 'window.__internal_ClerkUICtor = {};' }));
});

async function signIn(page, method = 'email-code', next = '/account') {
  await page.goto(app + '/sign-in?next=' + encodeURIComponent(next));
  await page.locator('#' + method).click();
  await expect(page).toHaveURL(app + next);
  await page.waitForFunction(() => !!window.QaNinjaAuth);
  await page.evaluate(() => QaNinjaAuth.ready.then(() => true));
}
// Start the page already signed in as a given test user (the Clerk double keeps the user in sessionStorage).
const signedInAs = (page, id) => page.addInitScript(user => sessionStorage.setItem('test_clerk_user', user), String(id));

for (const method of ['email-code', 'google']) test(`app: ${method} sign-in reaches the account and signs out`, async ({ page }) => {
  await signIn(page, method);
  await expect(page.locator('body')).toHaveAttribute('data-user-subject', 'user_1');
  await expect(page.locator('.facts')).toContainText('user_1@example.com');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.locator('[data-logout]').click();
  await expect(page.locator('a[href="/sign-in?next=/account"]')).toBeVisible();
  await expect(page.locator('[data-logout]')).toBeHidden();
});

test('app: signed-out visitors sign in and return to the page they asked for', async ({ page }) => {
  await page.goto(app + '/workflow/1');
  await expect(page).toHaveURL(app + '/sign-in?next=%2Fworkflow%2F1');
  await page.locator('#email-code').click();
  await expect(page).toHaveURL(app + '/workflow/1');
  await expect(page.locator('h1')).toHaveText('Checkout');
  await expect(page).toHaveTitle('Checkout · QA Ninja');
  await expect(page.locator('.tabs a[href="/dashboard"]')).toHaveAttribute('aria-current', 'true');
});

test('app: the root sends visitors to sign-in or to their recordings', async ({ page }) => {
  await page.goto(app + '/');
  await expect(page).toHaveURL(app + '/sign-in');
  await page.locator('#email-code').click();
  await expect(page).toHaveURL(app + '/dashboard');
  await page.goto(app + '/');
  await expect(page).toHaveURL(app + '/dashboard');
});

test('app: sign-in only returns to known pages', async ({ page }) => {
  for (const next of ['https://evil.example/', '//evil.example', '/workflow/0', '/workflow/12/../../evil', '/account#evil', '/workflows/1/download']) {
    await page.goto(app + '/sign-in?next=' + encodeURIComponent(next));
    await expect.poll(() => page.evaluate(() => window.lastMount?.options.forceRedirectUrl)).toBe('/sign-in?next=%2Fdashboard');
  }
});

test('app: the recording page loads screenshots and files with the sign-in token', async ({ page }) => {
  await signIn(page, 'email-code', '/workflow/1');
  const shot = page.locator('.step-shot img');
  await expect(shot).toHaveAttribute('alt', 'Step 1 screenshot: Click checkout');
  await expect.poll(() => shot.evaluate(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0)).toBe(true);
  let download = page.waitForEvent('download');
  await page.getByText('Download all files (ZIP)').click();
  expect((await download).suggestedFilename()).toBe('QaNinja-1.zip');
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Recording (JSON)' }).click();
  expect((await download).suggestedFilename()).toBe('recording.json');
  // The step's screenshot appears with its step, not again in the file list.
  await expect(page.locator('.download-groups')).not.toContainText('shot.jpg');
});

test('app: deleting sends a bearer token and retries a stale one once', async ({ page }) => {
  await signIn(page, 'email-code', '/dashboard');
  // The list's own requests use the token first, so wait for it before making the next one stale.
  await expect(page.locator('[data-delete="1"]')).toBeVisible();
  const authorizations = [];
  page.on('request', request => { if (request.method() === 'DELETE') authorizations.push(request.headers().authorization); });
  await page.evaluate(() => { window.staleTokenOnce = true; });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('[data-delete="1"]').click();
  await expect(page).toHaveURL(app + '/dashboard?deleted=1');
  expect(authorizations).toEqual(['Bearer stale-token', expect.stringMatching(/^Bearer ey/)]);
  await expect(page.locator('.recording')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Recording deleted.');
});

test('app: switching accounts reloads the page for the new account', async ({ page }) => {
  await signIn(page);
  await Promise.all([page.waitForEvent('load'), page.evaluate(() => { setTimeout(() => Clerk.switchUser('2')); })]);
  await expect(page.locator('body')).toHaveAttribute('data-user-subject', 'user_2');
  await expect(page.locator('.facts')).toContainText('user_2@example.com');
});

test('app: sign-in and sign-up share the legacy page and link to each other', async ({ page }) => {
  await page.goto(app + '/sign-in?next=/account');
  await expect(page.locator('.auth-card img[src^="/assets/lockup-"]')).toBeVisible();
  await expect(page.locator('.auth-subtitle')).toHaveText('Sign in to capture, compose, and automate at the speed of your next click.');
  await expect(page).toHaveTitle('Sign in to QA Ninja');
  await expect(page.locator('.site-header')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.lastMount?.kind)).toBe('signIn');
  expect(await page.evaluate(() => window.lastMount.options.signUpUrl)).toBe('/sign-in?mode=signup&next=%2Faccount');
  // The legacy theme reaches Clerk.
  expect(await page.evaluate(() => window.loadOptions.appearance.options.elevation)).toBe('flush');
  expect(await page.evaluate(() => window.loadOptions.localization.signUp.start.title)).toBe('Join the Clan');
  await page.goto(app + '/sign-in?mode=signup&next=/account');
  await expect(page).toHaveTitle('Join QA Ninja');
  await expect.poll(() => page.evaluate(() => window.lastMount?.kind)).toBe('signUp');
  expect(await page.evaluate(() => window.lastMount.options.signInUrl)).toBe('/sign-in?next=%2Faccount');
  await page.locator('#email-code').click();
  await expect(page).toHaveURL(app + '/account');
});

test('app: recording text is shown as text, never as markup', async ({ page, request }) => {
  const { token } = await (await request.get(api + '/_test/session?user_id=1')).json();
  const id = crypto.randomUUID();
  const label = '<img src=x onerror="window.injected = 1">';
  const recording = { schema_version: 1, id, steps: [{ label, url: 'https://example.com/?q=<b>', xpath: '//a[@title="<i>"]' }] };
  const created = await request.post(api + '/workflows', {
    headers: { Authorization: 'Bearer ' + token },
    multipart: { metadata: JSON.stringify({ client_id: id, name: '<b>Bold</b> recording' }), files: { name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(recording)) } },
  });
  expect(created.ok()).toBe(true);
  await signIn(page, 'email-code', '/dashboard');
  await expect(page.locator('.recording-name').first()).toHaveText('<b>Bold</b> recording');
  await page.goto(app + '/workflow/' + (await created.json()).id);
  await expect(page.locator('.step-label')).toHaveText(label);
  await expect(page.locator('.well code')).toHaveText('//a[@title="<i>"]');
  await expect(page.locator('.step img, .step b, .step i')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('app: a recording without an active plan explains how to get one', async ({ page }) => {
  await signedInAs(page, 2);
  await page.goto(app + '/workflow/1');
  await expect(page.locator('h1')).toHaveText('Viewing recordings needs an active plan');
  await expect(page.locator('.error-page a')).toHaveAttribute('href', '/account');
});

test('app: missing recordings and malformed links explain what happened', async ({ page }) => {
  await signedInAs(page, 1);
  await page.goto(app + '/workflow/999');
  await expect(page.locator('h1')).toHaveText("We couldn't find that recording");
  await page.goto(app + '/workflow/abc');
  await expect(page.locator('h1')).toHaveText("That link doesn't look right");
});

test('app: plan buttons report billing errors from the API', async ({ page }) => {
  await signedInAs(page, 2);
  await page.goto(app + '/account');
  await page.locator('[data-plan="BASIC"][data-interval="monthly"]').click();
  await expect(page.locator('#message')).toContainText('Billing is not configured yet');
  await expect(page.locator('[data-plan="BASIC"][data-interval="monthly"]')).toBeEnabled();
});

test('app: unknown pages are a 404 with a way back', async ({ page }) => {
  const response = await page.goto(app + '/nope');
  expect(response.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page not found');
  await expect(page.locator('.site-header')).toBeVisible();
  expect(response.headers()['x-frame-options']).toBe('DENY');
});

test('app: the built site carries the CSP, hashed assets, and no inline scripts or secret keys', async () => {
  const dist = path.join(__dirname, '..', 'test-dist');
  const pages = fs.readdirSync(dist).filter(name => name.endsWith('.html'));
  // One page for every path; 404.html is the same page, served with a 404 status.
  expect(pages.sort()).toEqual(['404.html', 'index.html']);
  for (const name of pages) {
    const html = fs.readFileSync(path.join(dist, name), 'utf8');
    expect(html, name).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'self';[^"]* connect-src 'self' http:\/\/127\.0\.0\.1:8766 /);
    expect(html, name).not.toMatch(/<script(?![^>]*\bsrc=)/);
    // Clerk's deferred scripts run before the app's module entry.
    expect(html.indexOf('clerk.browser.js'), name).toBeGreaterThan(0);
    expect(html.indexOf('clerk.browser.js'), name).toBeLessThan(html.indexOf('type="module"'));
  }
  // Every asset is named by its content, which is what lets render.yaml cache /assets/* for good.
  for (const name of fs.readdirSync(path.join(dist, 'assets'))) expect(name).toMatch(/-[\w-]{8}\.[a-z0-9]+$/);
  for (const name of fs.readdirSync(dist, { recursive: true }).filter(name => /\.(html|js|css)$/.test(name))) {
    expect(fs.readFileSync(path.join(dist, name), 'utf8'), name).not.toMatch(/sk_(test|live)_/);
  }
});

test('app: design tokens match the extension side panel', async () => {
  const sidebar = path.resolve(__dirname, '../../extension/sidebar.css');
  test.skip(!fs.existsSync(sidebar), 'The extension folder is not next to the app.');
  const tokens = file => /\/\* tokens:start \*\/.*?\/\* tokens:end \*\//s.exec(fs.readFileSync(file, 'utf8'))?.[0];
  expect(tokens(path.join(__dirname, '..', 'src', 'styles', 'tokens.css'))).toBe(tokens(sidebar));
});

test('app: recordings sit on the trail and open in place', async ({ page }) => {
  await signIn(page, 'email-code', '/dashboard');
  await expect(page.locator('.recording')).toHaveCount(1);
  await expect(page.locator('.recording .meta')).toContainText('1 step, saved');
  await expect(page.locator('.usage')).toContainText('1 of 25 dashboard recordings used');
  // Moving between pages doesn't reload the app, and focus follows to the new page.
  await page.evaluate(() => { window.samePage = true; });
  await page.locator('.recording-name a').click();
  await expect(page).toHaveURL(app + '/workflow/1');
  await expect(page.locator('h1')).toHaveText('Checkout');
  await expect(page.locator('main')).toBeFocused();
  await page.locator('.tabs a[href="/account"]').click();
  await expect(page).toHaveURL(app + '/account');
  await expect(page.locator('.tabs a[href="/account"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.facts')).toContainText('user_1@example.com');
  expect(await page.evaluate(() => window.samePage)).toBe(true);
});

test('app: a linked step is the target, and copying its XPath confirms with a check and a toast', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: app });
  await signIn(page, 'email-code', '/workflow/1');
  await page.goto(app + '/workflow/1#step-1');
  await expect(page.locator('#step-1')).toHaveAttribute('aria-current', 'step');
  const copy = page.getByRole('button', { name: 'Copy XPath for step 1' });
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied', 'true');
  await expect(page.locator('.toast-title')).toHaveText('XPath copied');
  await expect(page.locator('.toast-detail')).toHaveText('//button');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('//button');
  // The check and the toast leave on their own.
  await expect(copy).not.toHaveAttribute('data-copied');
  await expect(page.locator('.toast')).toHaveCount(0);
});

// Execute. api/tests/browser_server.py seeds workflow 1's settings, an API-key connection, and one finished run.
const CONNECTION = 'conn_c0ffee00000000000000000000000000';
const RUN = 'run_5eed0000000000000000000000000001';
const EXTENSION = 'omlmffaaomacajicfhfofoackdnfocdg';
const signedInExtension = { ok: true, version: '2.1.0', signedIn: true, subject: 'user_1', execute: true };
// Stand in for the QA Ninja extension: chrome.runtime.sendMessage answers by message type and records what it was sent.
const stubExtension = (page, answers) => page.addInitScript(answers => {
  window.extensionMessages = [];
  const runtime = { sendMessage(id, message, callback) { window.extensionMessages.push({ id, message }); setTimeout(() => callback(answers[message.type]), 20); } };
  try { Object.defineProperty(window, 'chrome', { value: { ...window.chrome, runtime }, configurable: true, writable: true }); } catch { window.chrome.runtime = runtime; }
}, answers);
const corsHeaders = { 'Access-Control-Allow-Origin': app, 'Content-Type': 'application/json' };

test('app: the Execute tab sits between Recordings and Account and stays marked on its pages', async ({ page }) => {
  await signIn(page, 'email-code', '/dashboard');
  await expect(page.locator('.site-header .tabs a')).toHaveText(['Recordings', 'Execute', 'Account']);
  await page.locator('.tabs a[href="/execute"]').click();
  await expect(page).toHaveURL(app + '/execute');
  await expect(page.locator('h1')).toHaveText('Execute');
  await expect(page).toHaveTitle('Execute · QA Ninja');
  await expect(page.locator('.tabs a[href="/execute"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.tabs a[href="/dashboard"]')).not.toHaveAttribute('aria-current');
  // The page's own tabs are a tablist that follows ?tab=, with arrow keys.
  await expect(page.getByRole('tab', { name: 'Run a test' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: 'Run a test' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(app + '/execute?tab=runs');
  await expect(page.getByRole('tab', { name: 'Runs' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Runs' })).toBeFocused();
  await expect(page.locator('.tabs a[href="/execute"]')).toHaveAttribute('aria-current', 'page');
  await page.locator(`.run-row[data-run-id="${RUN}"] .run-name a`).click();
  await expect(page).toHaveURL(`${app}/execute/runs/${RUN}`);
  await expect(page.locator('.tabs a[href="/execute"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('main')).toBeFocused();
});

test('app: sign-in returns to Execute pages', async ({ page }) => {
  await page.goto(app + '/execute?tab=agents');
  await expect(page).toHaveURL(app + '/sign-in?next=%2Fexecute%3Ftab%3Dagents');
  await page.locator('#email-code').click();
  await expect(page).toHaveURL(app + '/execute?tab=agents');
  await expect(page.getByRole('tab', { name: 'Agents' })).toHaveAttribute('aria-selected', 'true');
  await page.evaluate(() => QaNinjaAuth.signOut());
  await expect(page).toHaveURL(app + '/account');
  await page.goto(`${app}/execute/runs/${RUN}`);
  await expect(page).toHaveURL(`${app}/sign-in?next=%2Fexecute%2Fruns%2F${RUN}`);
  await page.locator('#email-code').click();
  await expect(page).toHaveURL(`${app}/execute/runs/${RUN}`);
  await expect(page.locator('h1')).toHaveText('Checkout');
});

test('app: Run a test lists the seeded test with its last verdict and its saved agent and mode', async ({ page }) => {
  await signIn(page, 'email-code', '/execute');
  const item = page.locator('.test-item');
  await expect(item).toHaveCount(1);
  await expect(item).toHaveAttribute('data-selected', 'true');
  await expect(item.locator('.test-name')).toHaveText('Checkout');
  await expect(item).toContainText('1 step · last run');
  await expect(item.locator('[data-verdict="FAILED"]')).toHaveText('Failed');
  await expect(page.locator('.test-head h2')).toHaveText('Checkout');
  // The QA Ninja Agent needs the server's key, which the test API doesn't have; the seeded connection is the default.
  await expect(page.getByRole('radio', { name: /QA Ninja Agent/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /Team key/ })).toBeChecked();
  await expect(page.locator('.choice[data-brain="managed"]')).toContainText('Not available right now. 0 of 10 included runs used this month.');
  expect(await page.locator('.choice[data-brain="managed"] .usage-rail').evaluate(rail => [rail.style.getPropertyValue('--used'), rail.style.getPropertyValue('--total')])).toEqual(['0', '10']);
  await expect(page.getByRole('radio', { name: /Assisted/ })).toBeChecked();
  // Replay only takes assisted and agent modes off the table.
  await page.getByRole('radio', { name: /Replay only/ }).check();
  await expect(page.getByRole('radio', { name: /^Replay The recorded steps/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /^Agent Goal-driven/ })).toBeDisabled();
  await expect(page.locator('#settings-goal')).toHaveValue('Check out the cart and reach the order confirmation.');
  await expect(page.locator('.test-step-list .step-label')).toHaveText(['Click checkout']);
  await expect(page.locator('.test-panel .run-row')).toHaveCount(1);
  await expect(page.locator('[data-extension="missing"]')).toHaveText('Runs need the QA Ninja extension in this Chrome.');
  await expect(page.locator('[data-secrets]')).toHaveText('This test needs: Password (password). Enter secrets in the QA Ninja extension; they stay in your browser.');
});

test("app: saving a test's settings sends them with PUT", async ({ page }) => {
  await signIn(page, 'email-code', '/execute');
  await page.locator('.test-link').click();
  await expect(page).toHaveURL(app + '/execute?tab=run&test=1');
  await page.locator('#settings-base').fill('https://staging.example.com/app');
  await page.locator('[data-save-settings]').click();
  await expect(page.locator('#settings-base-error')).toHaveText('Use an origin like https://staging.example.com, with no path.');
  await expect(page.locator('#settings-base')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#message')).toContainText('Check the highlighted settings');
  await page.locator('#settings-base').fill('https://staging.example.com');
  await page.locator('#settings-goal').fill('Buy two hats');
  await page.getByRole('button', { name: 'Add an input' }).click();
  await page.getByRole('textbox', { name: 'Input 2 name' }).fill('size');
  await page.getByRole('textbox', { name: 'Input 2 value' }).fill('L');
  await expect(page.locator('.settings')).toContainText('Unsaved changes');
  const saved = page.waitForRequest(request => request.method() === 'PUT');
  await page.locator('[data-save-settings]').click();
  const request = await saved;
  expect(request.url()).toBe(api + '/execute/tests/1/settings');
  expect(request.postDataJSON()).toEqual({
    goal: 'Buy two hats', expected_outcome: 'The page says "Thank you for your order".', base_url: 'https://staging.example.com',
    allowed_origins: ['https://example.com'], inputs: { email: 'qa@example.com', size: 'L' }, secrets: [{ name: 'password', label: 'Password' }],
    assertions: [{ type: 'text_visible', value: 'Thank you' }], default_mode: 'assisted', default_brain: CONNECTION,
  });
  await expect(page.locator('.toast-title')).toHaveText('Settings saved');
  await expect(page.locator('.settings')).not.toContainText('Unsaved changes');
  await page.reload();
  await expect(page.locator('#settings-goal')).toHaveValue('Buy two hats');
  await expect(page.locator('#settings-base')).toHaveValue('https://staging.example.com');
  await expect(page.getByRole('textbox', { name: 'Input 2 value' })).toHaveValue('L');
});

test('app: running a test on this computer asks once, queues the run, and hands it to the extension', async ({ page }) => {
  await stubExtension(page, { QANINJA_PING: signedInExtension, QANINJA_RUN: { ok: true } });
  await signIn(page, 'email-code', '/execute');
  await expect(page.locator('[data-extension="found"]')).toHaveText('Runs in a new Chrome window, through the QA Ninja extension 2.1.0.');
  const started = page.waitForRequest(request => request.method() === 'POST' && request.url() === api + '/execute/runs');
  await page.getByRole('button', { name: 'Run on this computer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Let QA Ninja run tests in Chrome?' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('opens a new Chrome window and controls it');
  await expect(dialog).toContainText('Screenshots and page text from that window go to the agent you chose and its provider.');
  await expect(dialog).toContainText('Use staging sites and test accounts.');
  await dialog.getByRole('button', { name: 'Allow and run' }).click();
  expect((await started).postDataJSON()).toEqual({ workflow_id: 1, origin: 'dashboard', mode: 'assisted', brain: CONNECTION, base_url: '', inputs: { email: 'qa@example.com' } });
  await expect(page).toHaveURL(/\/execute\/runs\/run_[0-9a-f]{32}$/);
  const runId = page.url().split('/').pop();
  await expect(page.locator('.run-head [data-status="queued"]')).toHaveText('Queued');
  await expect(page.locator('.run-outcome')).toContainText('Waiting for the extension to start it');
  // The page pinged the extension to show its status; Run pinged again, then handed over the run as this account.
  const messages = await page.evaluate(() => window.extensionMessages);
  expect(messages.every(({ id }) => id === EXTENSION)).toBe(true);
  expect(messages.slice(-2).map(({ message }) => message)).toEqual([
    { type: 'QANINJA_PING' },
    { type: 'QANINJA_RUN', runId, subject: 'user_1', consent: true },
  ]);
  expect(await page.evaluate(() => localStorage.getItem('qaninja.execute.consent'))).toBe('1');
  // The run's page follows it; a queued run can be cancelled.
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(page.locator('.run-head [data-status="cancelled"]')).toHaveText('Cancelled');
  await expect(page.getByRole('button', { name: 'Run again' })).toBeVisible();
  // Consent is remembered: the next run asks nothing.
  await page.getByRole('button', { name: 'Run again' }).click();
  await expect(page).not.toHaveURL(`${app}/execute/runs/${runId}`);
  await expect(page).toHaveURL(/\/execute\/runs\/run_[0-9a-f]{32}$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('app: without the extension, running a test explains how to get it and starts nothing', async ({ page }) => {
  const runs = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().startsWith(api + '/execute/runs')) runs.push(request.url()); });
  await signIn(page, 'email-code', '/execute');
  await page.getByRole('button', { name: 'Run on this computer' }).click();
  await expect(page.locator('.run-problem')).toContainText('Install the QA Ninja extension in this Chrome to run tests on this computer.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(runs).toEqual([]);
});

test('app: a run the extension refuses is cancelled and explained', async ({ page, request }) => {
  await stubExtension(page, { QANINJA_PING: signedInExtension, QANINJA_RUN: { ok: false, error: 'busy', message: 'A run is in progress.' } });
  await page.addInitScript(() => localStorage.setItem('qaninja.execute.consent', '1'));
  await signIn(page, 'email-code', '/execute');
  await page.getByRole('button', { name: 'Run on this computer' }).click();
  await expect(page.locator('.run-problem')).toHaveText('The extension is already running a test. Stop it or let it finish, then try again.');
  await expect(page).toHaveURL(app + '/execute');
  const { token } = await (await request.get(api + '/_test/session?user_id=1')).json();
  const { data } = await (await request.get(api + '/execute/runs', { headers: { Authorization: 'Bearer ' + token } })).json();
  expect(data.map(run => [run.origin, run.status, run.error])).toEqual([['dashboard', 'cancelled', 'cancelled_by_user'], ['dashboard', 'completed', '']]);
});

test('app: Runs lists the seeded run with its verdict, agent, and steps', async ({ page }) => {
  await signIn(page, 'email-code', '/execute?tab=runs');
  const row = page.locator('.run-row');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.run-name')).toHaveText('Checkout');
  await expect(row.locator('[data-verdict="FAILED"]')).toHaveText('Failed');
  await expect(row).toContainText('Assisted · Anthropic (your key) · claude-sonnet-5-5');
  await expect(row).toContainText('1 of 2 steps passed, 1 healed · 1m 12s');
  await expect(row.locator('.run-name a')).toHaveAttribute('href', `/execute/runs/${RUN}`);
});

test('app: a run shows each step beside its recorded screenshot, the errors, and the agent transcript', async ({ page }) => {
  await signIn(page, 'email-code', `/execute/runs/${RUN}`);
  await expect(page).toHaveTitle('Checkout run · QA Ninja');
  await expect(page.locator('.run-head [data-verdict="FAILED"]')).toHaveText('Failed');
  await expect(page.locator('.run-outcome')).toContainText('The order confirmation never appeared after Place order.');
  await expect(page.locator('.run-facts')).toContainText('Anthropic (your key) · claude-sonnet-5-5');
  await expect(page.locator('.run-facts')).toContainText('$0.0184 · 1 model call');
  await expect(page.locator('.run-facts')).toContainText('3,120 in · 240 out · 2,048 cached');
  const steps = page.locator('.run-step');
  await expect(steps).toHaveCount(2);
  await expect(steps.nth(0).locator('[data-step-status]')).toHaveText('Healed');
  await expect(steps.nth(1).locator('[data-step-status]')).toHaveText('Failed');
  await expect(steps.nth(1)).toHaveAttribute('data-failing', 'true');
  await expect(steps.nth(1).locator('.step-error')).toHaveText('element_not_found No element matched //button[@id="place-order"].');
  // Recorded and this run, side by side, both fetched with the sign-in token.
  for (const alt of ['Step 1 as recorded: Click checkout', 'Step 1 in this run: Click checkout']) {
    const shot = page.getByRole('img', { name: alt });
    await expect.poll(() => shot.evaluate(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0)).toBe(true);
  }
  // The failing step is a link away.
  await page.locator('.run-failing a').click();
  await expect(page).toHaveURL(`${app}/execute/runs/${RUN}#step-2`);
  await expect(page.locator('#step-2')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.event-group')).toHaveCount(1);
  await expect(page.locator('.event-group h3')).toHaveText('Step 2: Place order');
  await expect(page.locator('.event code')).toHaveText("Uncaught TypeError: Cannot read properties of undefined (reading 'total')");
  // The transcript: the latest episode is open, its tool call is compact text, and its screenshot loads as a blob.
  const episode = page.locator('.episode');
  await expect(episode).toHaveAttribute('open', '');
  await expect(episode.locator('> summary')).toContainText('Fixing a step, step 1');
  await expect(episode.locator('[data-entry="assistant"]')).toContainText('The button was renamed, so I am looking it up by its role.');
  await expect(episode.locator('.calls code')).toHaveText('find({"query":"checkout button"})');
  await expect(episode.locator('[data-entry="result"] pre')).toHaveText('button "Checkout" [ref_3]');
  const seen = page.getByRole('img', { name: 'Screenshot the agent saw after find' });
  await seen.scrollIntoViewIfNeeded();
  await expect.poll(() => seen.evaluate(image => image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0)).toBe(true);
  await episode.locator('> summary').click();
  await expect(episode).not.toHaveAttribute('open');
  // Accepting the healed step's fix.
  const accepted = page.waitForRequest(request => request.method() === 'POST' && request.url() === api + '/execute/tests/1/heals');
  await page.getByRole('button', { name: 'Accept fix for step 1' }).click();
  expect((await accepted).postDataJSON()).toEqual({ run_id: RUN, step_index: 0 });
  await expect(page.locator('.toast-title')).toHaveText('Fix accepted');
  await expect(page.locator('.heal-accepted')).toBeVisible();
  await page.goto(app + '/execute');
  await expect(page.locator('.test-step-list')).toContainText('replays an accepted fix');
  await expect(page.getByRole('button', { name: 'Clear accepted fixes' })).toBeVisible();
});

test('app: deleting a run returns to the runs', async ({ page }) => {
  await signIn(page, 'email-code', `/execute/runs/${RUN}`);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete run' }).click();
  await expect(page).toHaveURL(app + '/execute?tab=runs');
  await expect(page.locator('.toast-title')).toHaveText('Run deleted');
  await expect(page.locator('.run-row')).toHaveCount(0);
  await expect(page.locator('.empty-state h2')).toHaveText('No runs yet');
});

test('app: Agents show the QA Ninja Agent and the connection by its last four, and rename it', async ({ page }) => {
  await signIn(page, 'email-code', '/execute?tab=agents');
  await expect(page.locator('[data-connection="managed"]')).toContainText('Not available right now');
  await expect(page.locator('[data-managed-usage]')).toContainText('0 of 10 included runs used this month. Resets');
  const connection = page.locator(`[data-connection="${CONNECTION}"]`);
  await expect(connection.locator('.connection-name')).toHaveText('Team key');
  await expect(connection).toContainText('Anthropic · ••••abcd · claude-sonnet-5-5');
  await connection.getByRole('button', { name: 'Rename Team key' }).click();
  await connection.getByLabel('Name').fill('Staging key');
  const renamed = page.waitForRequest(request => request.method() === 'PATCH');
  await connection.getByRole('button', { name: 'Save name' }).click();
  expect((await renamed).postDataJSON()).toEqual({ label: 'Staging key' });
  await expect(connection.locator('.connection-name')).toHaveText('Staging key');
  await expect(page.locator('.toast-title')).toHaveText('Agent renamed');
  await expect(page.getByRole('button', { name: 'Sign in with ChatGPT' })).toBeDisabled();
  // Coding agents: the local bridge for each client, and no remote server while the API has it off.
  await expect(page.locator('[data-snippet="claude-code"] code')).toHaveText('claude mcp add qaninja -- npx -y @qaninja/mcp');
  await expect(page.locator('[data-snippet="codex"] code')).toHaveText('codex mcp add qaninja -- npx -y @qaninja/mcp');
  await expect(page.locator('[data-snippet="cursor"] code')).toHaveText('{"mcpServers":{"qaninja":{"command":"npx","args":["-y","@qaninja/mcp"]}}}');
  await expect(page.locator('[data-snippet="claude-desktop"]')).toBeVisible();
  await expect(page.locator('[data-snippet="remote"]')).toHaveCount(0);
  await expect(page.locator('.agents')).toContainText("Claude Pro/Max subscriptions can't be used by other apps; use an Anthropic API key, or connect Claude Code through MCP to use your plan.");
});

test('app: adding an API key lists its models once, and the key is never shown again', async ({ page }) => {
  // The test API can't reach providers, so the provider-backed calls are answered here.
  const key = 'sk-test-0123456789abcdef-wxyz';
  const created = { id: 'conn_' + '1'.repeat(32), provider: 'openai', kind: 'api_key', label: 'OpenAI', model: '', last4: 'wxyz', status: 'active', created_at: 1790000000, last_used_at: null };
  const sent = [];
  await page.route(api + '/execute/connections', route => {
    if (route.request().method() !== 'POST') return route.fallback();
    sent.push(route.request().postDataJSON());
    return route.fulfill({ headers: corsHeaders, body: JSON.stringify({ ...created, models: ['gpt-5.5', 'gpt-5.5-mini'] }) });
  });
  await page.route(`${api}/execute/connections/${created.id}`, route => {
    sent.push(route.request().postDataJSON());
    return route.fulfill({ headers: corsHeaders, body: JSON.stringify({ ...created, model: 'gpt-5.5-mini' }) });
  });
  await signIn(page, 'email-code', '/execute?tab=agents');
  await page.getByLabel('Provider').selectOption('openai');
  await page.getByLabel('API key', { exact: true }).fill(key);
  await page.locator('[data-add-key]').click();
  await expect(page.locator('.toast-title')).toHaveText('Key added');
  const added = page.locator(`[data-new-connection="${created.id}"]`);
  await expect(added).toContainText('OpenAI key ••••wxyz added.');
  await expect(added.getByLabel('Model').locator('option')).toHaveText(['gpt-5.5', 'gpt-5.5-mini']);
  await added.getByLabel('Model').selectOption('gpt-5.5-mini');
  await added.getByRole('button', { name: 'Save model' }).click();
  await expect(page.locator('.toast-title')).toHaveText('Model saved');
  expect(sent).toEqual([{ provider: 'openai', api_key: key }, { model: 'gpt-5.5-mini' }]);
  await expect(page.getByLabel('API key', { exact: true })).toHaveValue('');
  expect(await page.locator('body').innerText()).not.toContain(key);
});

test('app: Connect OpenRouter keeps the sign-in state in this tab and opens OpenRouter', async ({ page }) => {
  await page.route('https://openrouter.ai/**', route => route.fulfill({ contentType: 'text/html', body: '<title>OpenRouter</title>' }));
  await signIn(page, 'email-code', '/execute?tab=agents');
  await page.locator('[data-openrouter]').click();
  await expect(page).toHaveURL(/^https:\/\/openrouter\.ai\/auth\?/);
  const query = new URL(page.url()).searchParams;
  // The API names the callback on its APP_ORIGIN setting (http://testserver in the test API).
  expect(new URL(query.get('callback_url')).pathname).toBe('/execute/connect/openrouter');
  expect(query.get('code_challenge_method')).toBe('S256');
  await page.goto(app + '/execute?tab=agents');
  expect(await page.evaluate(() => sessionStorage.getItem('qaninja.openrouter.state'))).toMatch(/^[\w-]{40,}$/);
});

test("app: the OpenRouter callback explains a sign-in it can't finish", async ({ page }) => {
  await signIn(page, 'email-code', '/execute?tab=agents');
  // A state the API never issued: it refuses before any exchange with OpenRouter.
  await page.evaluate(() => sessionStorage.setItem('qaninja.openrouter.state', 'state-the-api-never-issued-0123456789'));
  const completed = page.waitForRequest(request => request.url() === api + '/execute/connections/openrouter/complete');
  await page.goto(app + '/execute/connect/openrouter?code=abc');
  expect((await completed).postDataJSON()).toEqual({ state: 'state-the-api-never-issued-0123456789', code: 'abc' });
  await expect(page.locator('h1')).toHaveText("We couldn't connect OpenRouter");
  await expect(page.locator('.error-page .lede')).toHaveText('This OpenRouter sign-in expired or belongs to another session. Start again.');
  await expect(page.locator('.error-page a')).toHaveAttribute('href', '/execute?tab=agents');
  await expect(page.locator('.error-page .meta')).toHaveText('Error 400');
  // The state is used once.
  expect(await page.evaluate(() => sessionStorage.getItem('qaninja.openrouter.state'))).toBeNull();
  await page.reload();
  await expect(page.locator('.error-page .lede')).toHaveText('This sign-in started in another tab, or it already finished. Start again from Agents.');
  await page.goto(app + '/execute/connect/openrouter');
  await expect(page.locator('.error-page .lede')).toHaveText("OpenRouter didn't send a sign-in code back. Start again from Agents.");
  await expect(page.locator('.tabs a[href="/execute"]')).toHaveAttribute('aria-current', 'true');
});

test('app: unknown runs and malformed run links explain what happened', async ({ page }) => {
  await signedInAs(page, 1);
  await page.goto(app + '/execute/runs/run_' + '0'.repeat(32));
  await expect(page.locator('h1')).toHaveText("We couldn't find that run");
  await expect(page.locator('.error-page a')).toHaveAttribute('href', '/execute?tab=runs');
  await expect(page.locator('.error-page .meta')).toHaveText('Error 404');
  await page.goto(app + '/execute/runs/abc');
  await expect(page.locator('h1')).toHaveText("That link doesn't look right");
  await expect(page.locator('.error-page a')).toHaveAttribute('href', '/execute?tab=runs');
});

test('app: Execute needs a paid plan', async ({ page }) => {
  await signedInAs(page, 2);
  await page.goto(app + '/execute');
  await expect(page.locator('.empty-state h2')).toHaveText('Run your tests with agents on a paid plan');
  await expect(page.locator('.empty-state a')).toHaveAttribute('href', '/account');
  await page.goto(app + '/execute?tab=agents');
  await expect(page.locator('.empty-state a')).toHaveText('See plans');
  await page.goto(app + '/execute?tab=runs');
  await expect(page.locator('.empty-state h2')).toHaveText('Run your tests with agents on a paid plan');
  // Another account's run is missing for this one.
  await page.goto(`${app}/execute/runs/${RUN}`);
  await expect(page.locator('h1')).toHaveText("We couldn't find that run");
});

test('app: a version 2 recording reads as its actions, and Run a test lists its secrets and inputs', async ({ page, request }) => {
  const { token } = await (await request.get(api + '/_test/session?user_id=1')).json();
  const id = crypto.randomUUID();
  const url = 'https://shop.example.com/login';
  const recording = { schema_version: 2, id, name: 'Sign up', start_url: url,
    inputs: [{ name: 'email_1', label: 'Email', default: 'qa@example.com' }], secrets: [{ name: 'password_1', label: 'Password', kind: 'secret' }],
    steps: [
      { action_type: 'click', label: 'Sign in', url, xpath: '//button[1]' },
      { action_type: 'fill', label: 'Name', url, xpath: '//input[1]', value: 'Ada <b>Lovelace</b>' },
      { action_type: 'fill', label: 'Email', url, xpath: '//input[2]', value: '', value_ref: { kind: 'input', name: 'email_1' } },
      { action_type: 'fill', label: 'Password', url, xpath: '//input[3]', value: '', sensitive: true, value_ref: { kind: 'secret', name: 'password_1' } },
      { action_type: 'select', label: 'Country', url, xpath: '//select', value: 'Canada' },
      { action_type: 'check', label: 'Remember me', url, xpath: '//input[4]' },
      { action_type: 'press', label: '', url, xpath: '//input[4]', key: 'Enter' },
      { action_type: 'navigate', label: '', url: 'https://shop.example.com/orders', xpath: '' },
    ] };
  const created = await request.post(api + '/workflows', {
    headers: { Authorization: 'Bearer ' + token },
    multipart: { metadata: JSON.stringify({ client_id: id, name: 'Sign up' }), files: { name: 'recording.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(recording)) } },
  });
  expect(created.ok()).toBe(true);
  const workflow = (await created.json()).id;
  await signIn(page, 'email-code', '/workflow/' + workflow);
  await expect(page.locator('.step-label')).toHaveText([
    'Sign in', 'Typed "Ada <b>Lovelace</b>" into Name', 'Typed an input (email_1) into Email', 'Typed a secret (password_1) into Password',
    'Selected "Canada" in Country', 'Checked Remember me', 'Pressed Enter', 'Opened https://shop.example.com/orders',
  ]);
  await expect(page.locator('.step b')).toHaveCount(0);
  // Opening a page has no XPath to show or copy.
  await expect(page.locator('#step-8 .well')).toHaveCount(0);
  await expect(page.locator('#step-1 .well code')).toHaveText('//button[1]');
  // The test needs its secret from the extension, and its recorded input starts at the recorded value.
  await page.goto(`${app}/execute?tab=run&test=${workflow}`);
  await expect(page.locator('.test-head h2')).toHaveText('Sign up');
  await expect(page.locator('[data-secrets]')).toHaveText('This test needs: Password (password_1). Enter secrets in the QA Ninja extension; they stay in your browser.');
  const input = page.locator('[data-input="email_1"]');
  await expect(input.locator('label')).toHaveText('Email email_1');
  await expect(input.getByRole('textbox', { name: 'Email email_1' })).toHaveValue('qa@example.com');
  await expect(input.getByRole('button', { name: /Remove/ })).toHaveCount(0);
  await expect(page.locator('.settings')).not.toContainText('Unsaved changes');
});
