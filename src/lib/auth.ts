// Clerk owns credentials and sessions. This module loads Clerk, reports who is signed in, and hands the session's
// short-lived token to api.ts, which sends it to the API as a Bearer header. Only public settings reach the browser.
import type { Clerk } from './clerk'
import { clerkTheme } from './clerk-theme'
import { clerkConfigured } from './config'
import { safeNext } from './views'

export const configured = clerkConfigured

// index.html puts clerk-js in a deferred script ahead of the app, so it has normally run by now. If the app ever runs
// first, wait for the page to finish loading before deciding Clerk is unavailable.
async function loadedClerk() {
  if (!window.Clerk && document.readyState !== 'complete') {
    await new Promise((resolve) =>
      window.addEventListener('load', resolve, { once: true })
    )
  }
  return window.Clerk
}

export const ready: Promise<Clerk> = (async () => {
  if (!configured)
    throw new Error(
      'Sign-in is not configured yet. XPath Finder in the extension remains available.'
    )
  const clerk = await loadedClerk()
  if (!clerk) throw new Error('Sign-in is unavailable. Please try again later.')
  // clerk-theme.ts supplies the legacy look (appearance) and titles (localization).
  await clerk.load({
    ui: { ClerkUI: window.__internal_ClerkUICtor },
    ...clerkTheme(),
  })
  return clerk
})()

export type AuthState =
  | { status: 'loading' }
  | { status: 'unavailable'; error: Error }
  | { status: 'ready'; userId: string | null }

// Who is signed in, for components (see hooks/useAuth.ts). Pages that show an account's data reload when it changes
// (watchIdentity); this only keeps the header and the sign-in page current.
let state: AuthState = { status: 'loading' }
const listeners = new Set<() => void>()

function publish(next: AuthState) {
  state = next
  for (const listener of listeners) listener()
}

// Each page reports a failure where it makes sense; public pages keep working without Clerk.
ready.then(
  (clerk) => {
    publish({ status: 'ready', userId: clerk.user?.id ?? null })
    clerk.addListener(({ user }) => {
      const userId = user?.id ?? null
      if (state.status === 'ready' && state.userId !== userId)
        publish({ status: 'ready', userId })
    })
  },
  (error: unknown) =>
    publish({
      status: 'unavailable',
      error: error instanceof Error ? error : new Error(String(error)),
    })
)

export function subscribeAuth(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const authState = () => state

export const signInUrl = (destination = location.pathname + location.search) =>
  '/sign-in?next=' + encodeURIComponent(safeNext(destination))

// Set while signing out: Clerk then leaves for /account itself, so the page shouldn't reload first.
let signingOut = false

// A page shows one account's data. If another tab signs in, signs out, or switches accounts, reload for the new one.
export function watchIdentity(clerk: Clerk) {
  const shown = clerk.user?.id ?? null
  document.body.dataset.userSubject = shown ?? ''
  const stop = clerk.addListener(({ user }) => {
    if (!signingOut && (user?.id ?? null) !== shown) location.reload()
  })
  return () => {
    if (typeof stop === 'function') stop()
  }
}

// The signed-in Clerk user ID: the subject the API and the extension both know the account by.
export async function currentSubject() {
  const clerk = await ready
  return clerk.user?.id ?? null
}

export async function token(fresh = false) {
  const clerk = await ready
  const { user, session } = clerk
  if (!user || !session) {
    location.assign(signInUrl())
    throw new Error('Sign in to continue.')
  }
  const value = await session.getToken({ skipCache: fresh })
  if (clerk.user?.id !== user.id || clerk.session?.id !== session.id)
    throw new Error(
      'Your account changed. Refresh this page before continuing.'
    )
  if (!value) throw new Error('Your session ended. Sign in again.')
  return value
}

export async function signOut() {
  const clerk = await ready
  signingOut = true
  try {
    await clerk.signOut({ redirectUrl: '/account' })
  } catch (error) {
    signingOut = false
    throw error
  }
}

declare global {
  interface Window {
    QaNinjaAuth?: {
      ready: Promise<Clerk>
      token: typeof token
      signOut: typeof signOut
    }
  }
}

// Tests (and the browser console) reach sign-in state through this handle.
window.QaNinjaAuth = { ready, token, signOut }
