// Clerk owns credentials and sessions. This module reads the session and hands its short-lived token to api.js,
// which sends it to the API as a Bearer header. Only public configuration (assets/config.js) reaches the browser.
import { safeNext } from './views.js';

const config = window.QaNinjaConfig || {};
export const configured = Boolean(config.clerkPublishableKey && config.clerkFrontendApi);

export const ready = (async () => {
  if (!configured) throw new Error('Sign-in is not configured yet. XPath Finder in the extension remains available.');
  if (!window.Clerk) throw new Error('Sign-in is unavailable. Please try again later.');
  // clerk-theme.js supplies the legacy look (appearance) and titles (localization).
  await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, ...window.QaNinjaClerkTheme });
  return window.Clerk;
})();
// Each page reports a failure where it makes sense; public pages keep working without Clerk.
ready.catch(() => {});

export const signInUrl = (destination = location.pathname + location.search) => '/sign-in?next=' + encodeURIComponent(safeNext(destination));

// A page shows one account's data. If another tab signs in, signs out, or switches accounts, reload for the new one.
export function watchIdentity(clerk) {
  const shown = clerk.user?.id ?? null;
  document.body.dataset.userSubject = shown ?? '';
  clerk.addListener(({ user }) => { if ((user?.id ?? null) !== shown) location.reload(); });
}

export async function token(fresh = false) {
  const clerk = await ready;
  if (!clerk.session) {
    location.assign(signInUrl());
    throw new Error('Sign in to continue.');
  }
  const subject = clerk.user.id, session = clerk.session;
  const value = await session.getToken({ skipCache: fresh });
  if (clerk.user?.id !== subject || clerk.session?.id !== session.id) throw new Error('Your account changed. Refresh this page before continuing.');
  if (!value) throw new Error('Your session ended. Sign in again.');
  return value;
}

export const signOut = async () => (await ready).signOut({ redirectUrl: '/account' });

// Tests (and the browser console) reach sign-in state through this handle.
window.QaNinjaAuth = { ready, token, signOut };
