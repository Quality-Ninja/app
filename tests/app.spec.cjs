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
  await expect(page.locator('.auth-card img[src="/assets/lockup.svg"]')).toBeVisible();
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
  expect(response.headers()['x-frame-options']).toBe('DENY');
});

test('app: built pages carry the CSP and no inline scripts or secret keys', async () => {
  const dist = path.join(__dirname, '..', 'test-dist');
  const pages = fs.readdirSync(dist).filter(name => name.endsWith('.html'));
  expect(pages.sort()).toEqual(['404.html', 'account.html', 'dashboard.html', 'index.html', 'sign-in.html', 'workflow.html']);
  for (const name of pages) {
    const html = fs.readFileSync(path.join(dist, name), 'utf8');
    expect(html, name).toMatch(/<meta http-equiv="Content-Security-Policy" content="default-src 'self';[^"]* connect-src 'self' http:\/\/127\.0\.0\.1:8766 /);
    expect(html, name).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(html, name).not.toMatch(/sk_(test|live)_/);
  }
  expect(fs.readFileSync(path.join(dist, 'assets', 'config.js'), 'utf8')).not.toMatch(/sk_(test|live)_/);
});

test('app: design tokens match the extension side panel', async () => {
  const sidebar = path.resolve(__dirname, '../../extension/sidebar.css');
  test.skip(!fs.existsSync(sidebar), 'The extension folder is not next to the app.');
  const tokens = file => /\/\* tokens:start \*\/.*?\/\* tokens:end \*\//s.exec(fs.readFileSync(file, 'utf8'))?.[0];
  expect(tokens(path.join(__dirname, '..', 'src', 'assets', 'app.css'))).toBe(tokens(sidebar));
});
