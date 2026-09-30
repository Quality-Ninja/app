// Renders each page from the API's JSON and wires its buttons. Recording text is always set as text, never as HTML.
import { ApiError, api, download, fetchFile } from './api.js';
import { configured, ready, signInUrl, signOut, watchIdentity } from './auth.js';
import { BAD_LINK, PLANS, errorPage, groupFiles, planName, safeNext, screenshotIds, utcIso } from './views.js';

const main = document.getElementById('content');
const message = document.getElementById('message');
const params = new URLSearchParams(location.search);
const page = document.body.dataset.page;

// Thrown once a navigation has started, so the page stops rendering without reporting an error.
class Leaving extends Error {}

function say(text, error = false) {
  message.textContent = text;
  message.classList.toggle('error', error);
}

// h('a', { href: '/x', class: 'button' }, 'Label'). Strings always become text nodes, never markup.
function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Replaces everything in <main> after the status line; the page CSS styles sections as direct children of <main>.
function show(...nodes) {
  for (const child of [...main.children]) if (child !== message) child.remove();
  main.append(...nodes.flat(Infinity).filter(Boolean));
  main.removeAttribute('aria-busy');
  localTimes();
}

function setSignedIn(signedIn) {
  const button = document.querySelector('[data-logout]');
  if (button) button.hidden = !signedIn;
}

function markTabs() {
  for (const tab of document.querySelectorAll('.tabs a')) {
    const current = tab.dataset.tab === page ? 'page' : page === 'workflow' && tab.dataset.tab === 'dashboard' ? 'true' : null;
    if (current) tab.setAttribute('aria-current', current); else tab.removeAttribute('aria-current');
  }
}

// Pages that need an account send signed-out visitors to sign in, and sign-in sends them back.
async function requireSignIn() {
  const clerk = await ready;
  if (!clerk.session) {
    location.replace(signInUrl());
    throw new Leaving();
  }
  watchIdentity(clerk);
  setSignedIn(true);
  return clerk;
}

// Stored times are UTC. The text shown before localTimes() runs keeps the zone explicit.
const localTime = (value, { kind = 'date', cls = null, suffix = ' UTC' } = {}) => h('time', { class: cls, 'data-local': kind, datetime: utcIso(value) }, `${value}${suffix}`);

function errorView(info, status) {
  document.title = `${info.title} · QA Ninja`;
  return h('section', { class: 'error-page' },
    h('h1', {}, info.title),
    h('p', { class: 'lede' }, info.message),
    h('a', { class: 'button primary', href: info.href }, info.action),
    status ? h('p', { class: 'meta' }, `Error ${status}`) : null);
}

/* Home: a signed-in visitor goes to their recordings; everyone else to sign-in. */

async function home() {
  try {
    const clerk = await ready;
    location.replace(clerk.session ? '/dashboard' : '/sign-in');
  } catch {
    location.replace('/sign-in');
  }
}

/* Sign-in: Clerk's form in the legacy shell, for the web app and the extension alike. */

async function signIn() {
  const signup = params.get('mode') === 'signup';
  const next = safeNext(params.get('next') || '/dashboard');
  document.title = signup ? 'Join QA Ninja' : 'Sign in to QA Ninja';
  document.querySelector('.auth-card').setAttribute('aria-label', signup ? 'Create your QA Ninja account' : 'Sign in to QA Ninja');
  const root = document.getElementById('clerk-sign-in');
  const retry = document.getElementById('auth-retry');
  retry.addEventListener('click', () => location.reload());
  let clerk;
  try {
    clerk = await ready;
  } catch (error) {
    if (configured) {
      say(error.message, true);
      retry.hidden = false;
    } else {
      const notice = document.getElementById('auth-unconfigured');
      notice.querySelector('h1').textContent = signup ? 'Join the Clan' : 'Log in';
      notice.hidden = false;
      root.remove();
    }
    return;
  }
  if (clerk.session) return location.replace(next);
  Object.assign(root.dataset, { mode: signup ? 'signup' : 'signin', next });
  const here = (view = signup) => '/sign-in?' + new URLSearchParams({ ...(view && { mode: 'signup' }), next });
  // Both views live on this page (?mode=signup), and each links to the other here. Never pass signInUrl to
  // Clerk.load without signUpUrl: that turns on Clerk's combined flow, which ignores these per-view URLs.
  if (signup) clerk.mountSignUp(root, { routing: 'hash', forceRedirectUrl: here(), signInForceRedirectUrl: here(), signInUrl: here(false) });
  else clerk.mountSignIn(root, { routing: 'hash', forceRedirectUrl: here(), signUpForceRedirectUrl: here(), signUpUrl: here(true) });
}

/* Account: plan and billing. Signed-out visitors see the plans and a way to sign in. */

async function account() {
  let clerk = null;
  try { clerk = await ready; } catch { /* Without Clerk, the signed-out view still lists the plans. */ }
  if (clerk) watchIdentity(clerk);
  if (!clerk?.session) return show(signedOutAccount());
  setSignedIn(true);
  show(signedInAccount(await api('/me/account')));
}

function planCards(canSubscribe) {
  return h('div', { class: 'plans' }, PLANS.map(plan => h('section', { class: 'plan', 'aria-labelledby': `plan-${plan.code.toLowerCase()}` },
    h('h3', { id: `plan-${plan.code.toLowerCase()}` }, plan.name),
    h('p', { class: 'price' }, `${plan.monthly} `, h('span', { class: 'meta' }, 'per month')),
    h('ul', { class: 'features' },
      h('li', {}, 'Unlimited XPath inspections'),
      h('li', {}, 'Workflow recording in the extension'),
      h('li', {}, 'Playwright, Selenium, Cypress, and Robot Framework scripts with a PDF report'),
      h('li', {}, 'Remembered save folder'),
      h('li', {}, plan.storage)),
    canSubscribe ? h('div', { class: 'row' },
      h('button', { type: 'button', 'data-plan': plan.code, 'data-interval': 'monthly' }, `${plan.monthly} per month`, h('span', { class: 'sr-only' }, `, ${plan.name}`)),
      h('button', { type: 'button', 'data-plan': plan.code, 'data-interval': 'yearly' }, `${plan.yearly} per year`, h('span', { class: 'sr-only' }, `, ${plan.name}`))) : null)));
}

function signedOutAccount() {
  return [
    h('div', { class: 'auth' },
      h('h1', {}, 'Sign in'),
      h('p', { class: 'hint' }, 'Sign in to see your recordings and manage your plan. XPath Finder in the extension is free for 50 inspections a day and needs no account.'),
      h('div', { class: 'row' },
        h('a', { class: 'button primary', href: '/sign-in?next=/account' }, 'Continue with email or Google'),
        h('a', { class: 'button', href: '/sign-in?mode=signup&next=/account' }, 'Create an account'))),
    h('section', { 'aria-labelledby': 'plans-title' },
      h('h2', { id: 'plans-title' }, 'Plans'),
      h('p', { class: 'hint' }, 'Sign in or create an account to subscribe.'),
      planCards(false)),
  ];
}

function signedInAccount(caps) {
  const checkout = params.get('checkout') === 'success';
  return [
    h('h1', {}, 'Account'),
    h('dl', { class: 'facts' }, h('dt', {}, 'Email'), h('dd', {}, caps.email), h('dt', {}, 'Plan'), h('dd', {}, planName(caps.plan))),
    checkout ? h('p', { class: 'notice' }, caps.recording
      ? 'Your plan is active. Open Record in the extension to start recording.'
      : 'Activating your plan. Refresh in a few seconds; recording unlocks in the extension once payment is confirmed.') : null,
    caps.recording ? [
      h('p', { class: 'hint' }, 'Change your plan, update payment details, or cancel in the billing portal.'),
      h('button', { type: 'button', class: 'primary', 'data-portal': true }, 'Manage subscription'),
    ] : checkout ? null : [
      h('section', { 'aria-labelledby': 'plans-title' }, h('h2', { id: 'plans-title' }, 'Choose a plan'), planCards(true)),
      h('p', {}, h('button', { type: 'button', class: 'quiet', 'data-portal': true }, 'Manage a previous subscription')),
    ],
    h('p', { class: 'meta' }, 'When your paid access ends, you can still download or delete your saved recordings.'),
  ];
}

/* Recordings: the signed-in user's saved recordings, which outlive a subscription for download and delete. */

async function dashboard() {
  await requireSignIn();
  const [caps, workflows] = await Promise.all([api('/me/capabilities'), api('/workflows')]);
  show(dashboardView(caps, workflows));
}

function usage(caps) {
  if (caps.cloud_limit === null) return h('p', { class: 'meta' }, 'Unlimited dashboard recordings');
  const limit = caps.cloud_limit, used = caps.cloud_used;
  return h('div', { class: 'usage' },
    h('label', { for: 'usage' }, `${used} of ${limit} dashboard recordings used`),
    h('meter', { id: 'usage', min: 0, max: limit, low: Math.round(limit * 0.8), high: limit - 1, optimum: 0, value: Math.min(used, limit) }, `${used} of ${limit}`));
}

function dashboardView(caps, workflows) {
  const list = workflows.length ? h('ul', { class: 'recordings', role: 'list' }, workflows.map(item => h('li', { class: 'recording' },
    h('h2', { class: 'recording-name' }, caps.recording ? h('a', { href: `/workflow/${item.id}` }, item.name) : item.name),
    localTime(item.created_at, { cls: 'meta' }),
    h('div', { class: 'recording-actions' },
      h('button', { type: 'button', class: 'quiet', 'data-download': `/workflows/${item.id}/download` }, 'Download ZIP', h('span', { class: 'sr-only' }, ` of ${item.name}`)),
      h('button', { type: 'button', class: 'quiet danger', 'data-delete': item.id }, 'Delete', h('span', { class: 'sr-only' }, ` ${item.name}`))))))
    : caps.recording ? h('div', { class: 'empty-state' },
      h('h2', {}, 'No recordings yet'),
      h('p', {}, 'In the extension, open Record, choose Dashboard under Save to, then finish a recording. It appears here.'))
    : h('div', { class: 'empty-state' },
      h('h2', {}, 'Record workflows with a paid plan'),
      h('p', {}, 'Recording turns your clicks into Playwright, Selenium, Cypress, and Robot Framework scripts, and saved recordings appear here. XPath Finder in the extension stays free for 50 inspections a day.'),
      h('a', { class: 'button primary', href: '/account' }, 'See plans'));
  return [
    h('div', { class: 'page-head' }, h('h1', {}, 'Recordings'), caps.recording ? usage(caps) : null),
    params.get('deleted') ? h('p', { class: 'notice' }, 'Recording deleted.') : null,
    !caps.recording && workflows.length ? h('div', { class: 'notice' }, h('p', {}, 'Your plan has ended. You can still download or delete these recordings. ', h('a', { href: '/account' }, 'See plans'))) : null,
    list,
  ];
}

/* One recording: its steps with screenshots, and every file it saved. */

async function workflow() {
  const id = /^\/workflow\/([1-9][0-9]{0,17})$/.exec(location.pathname)?.[1];
  if (!id) return show(errorView(BAD_LINK, 404));
  await requireSignIn();
  const data = await api(`/workflows/${id}`);
  document.title = `${data.name} · QA Ninja`;
  show(workflowView(data));
  loadScreenshots();
}

const backArrow = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [name, value] of Object.entries({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(name, value);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm12 19-7-7 7-7M19 12H5');
  svg.append(path);
  return svg;
};

function workflowView(data) {
  const steps = data.recording?.steps || [], artifacts = data.artifacts || [];
  const groups = groupFiles(artifacts, steps), shots = screenshotIds(artifacts);
  return [
    h('a', { class: 'back-link', href: '/dashboard' }, backArrow(), 'Recordings'),
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, data.name),
        h('p', { class: 'meta' }, `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}, recorded `, localTime(data.created_at))),
      h('button', { type: 'button', class: 'primary', 'data-download': `/workflows/${data.id}/download` }, 'Download all files (ZIP)')),
    groups.length ? h('section', { 'aria-labelledby': 'files-title' },
      h('h2', { id: 'files-title' }, 'Files'),
      h('div', { class: 'download-groups' }, groups.map(group => h('div', { class: 'download-group' },
        h('h3', {}, group.title),
        h('ul', { role: 'list' }, group.files.map(file => h('li', {},
          h('button', { type: 'button', class: 'link-button', 'data-download': `/workflows/${data.id}/files/${file.id}` }, file.label),
          file.label !== file.filename ? h('span', { class: 'meta code' }, file.filename) : null))))))) : null,
    h('section', { 'aria-labelledby': 'steps-title' },
      h('h2', { id: 'steps-title' }, 'Steps'),
      h('ol', { class: 'step-list' }, steps.map((step, index) => stepItem(data.id, step, index + 1, shots)))),
  ];
}

function stepItem(workflowId, step, n, shots) {
  const shot = step.screenshot ? shots.get(step.screenshot) : undefined;
  const label = step.label || 'Click';
  return h('li', { id: `step-${n}`, class: 'step' }, h('div', { class: 'step-grid' },
    h('div', {},
      h('h3', { class: 'step-label' }, label),
      h('p', { class: 'step-url meta', title: step.url }, step.url),
      h('div', { class: 'well' },
        h('code', {}, step.xpath),
        h('button', { type: 'button', class: 'quiet', 'data-copy': step.xpath }, 'Copy XPath', h('span', { class: 'sr-only' }, ` for step ${n}`))),
      h('p', { class: 'step-meta meta' },
        step.timestamp ? localTime(step.timestamp, { kind: 'time', suffix: '' }) : null,
        step.frameId ? h('span', {}, `Frame ${step.frameId}`) : null)),
    // The link and image get their blob: URL once the screenshot has loaded (loadScreenshots).
    shot ? h('a', { class: 'step-shot', target: '_blank', rel: 'noopener', 'data-shot': `/workflows/${workflowId}/preview/${shot}` },
      h('img', { alt: `Step ${n} screenshot: ${label}` })) : null));
}

// Screenshots need the sign-in token, so they load as blobs as they scroll into view.
function loadScreenshots() {
  const load = async link => {
    try {
      const { blob } = await fetchFile(link.dataset.shot);
      const url = URL.createObjectURL(blob);
      link.querySelector('img').src = url;
      link.href = url;
    } catch (error) {
      say(error.message, true);
    }
  };
  const links = [...main.querySelectorAll('[data-shot]')];
  if (!('IntersectionObserver' in window)) return links.forEach(load);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      load(entry.target);
    }
  }, { rootMargin: '200px' });
  links.forEach(link => observer.observe(link));
}

/* Buttons, times, and page start-up. */

function busy(button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
function release(button) { button.disabled = false; button.removeAttribute('aria-busy'); }

async function copy(button) {
  if (!navigator.clipboard) throw new Error('Copying needs a secure connection. Select the XPath and copy it instead.');
  await navigator.clipboard.writeText(button.dataset.copy);
  say('XPath copied.');
  const label = button.firstChild, original = label.textContent;
  label.textContent = 'Copied';
  setTimeout(() => { label.textContent = original; }, 1500);
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const action = ['plan', 'portal', 'delete', 'logout', 'copy', 'download'].find(name => button.hasAttribute('data-' + name));
  if (!action) return;
  if (action === 'delete' && !confirm('Permanently delete this cloud recording and its files? Local copies are kept.')) return;
  busy(button);
  try {
    if (action === 'plan') location.href = (await api('/billing/checkout', { method: 'POST', body: { plan: button.dataset.plan, interval: button.dataset.interval } })).url;
    if (action === 'portal') location.href = (await api('/billing/portal', { method: 'POST' })).url;
    if (action === 'delete') { await api('/workflows/' + button.dataset.delete, { method: 'DELETE' }); location.href = '/dashboard?deleted=1'; }
    if (action === 'logout') await signOut();
    if (action === 'copy') { await copy(button); release(button); }
    if (action === 'download') { await download(button.dataset.download); release(button); }
  } catch (error) {
    say(error.message, true);
    release(button);
  }
});

// Returning from Stripe restores this page from the back/forward cache with its buttons still busy.
window.addEventListener('pageshow', event => { if (event.persisted) document.querySelectorAll('button[aria-busy]').forEach(release); });

// Show stored UTC times in the reader's timezone; the original text stays if a value doesn't parse.
const formats = {
  time: new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }),
  date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
};
function localTimes() {
  for (const time of main.querySelectorAll('time[data-local]')) {
    const date = new Date(time.dateTime);
    if (!Number.isNaN(date.getTime())) time.textContent = (formats[time.dataset.local] || formats.date).format(date);
  }
}

async function run(render) {
  markTabs();
  try {
    await render();
  } catch (error) {
    // A 401 has already sent the visitor to sign in.
    if (error instanceof Leaving || (error instanceof ApiError && error.status === 401)) return;
    if (error instanceof ApiError) return show(errorView(errorPage(error.status, error.message, { recording: page === 'workflow' }), error.status));
    say(error.message, true);
    main.removeAttribute('aria-busy');
  }
}

const pages = { home, 'sign-in': signIn, account, dashboard, workflow };
if (pages[page]) run(pages[page]);
else {
  markTabs();
  ready.then(clerk => setSignedIn(Boolean(clerk.session))).catch(() => {});
}
