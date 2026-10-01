// The part of Clerk's browser SDK that the app uses. index.html loads clerk-js 6 and Clerk's UI bundle from the Clerk
// Frontend API; the browser tests replace both with tests/clerk-web-double.js, which implements this same surface.

export type ClerkUser = { id: string }

export type ClerkSession = {
  id: string
  getToken(options?: { skipCache?: boolean }): Promise<string | null>
}

export type ClerkLoadOptions = {
  ui: { ClerkUI: unknown }
  appearance: object
  localization: object
}

type MountOptions = { routing: 'hash'; forceRedirectUrl: string }

export type SignInMountOptions = MountOptions & {
  signUpForceRedirectUrl: string
  signUpUrl: string
}

export type SignUpMountOptions = MountOptions & {
  signInForceRedirectUrl: string
  signInUrl: string
}

export type Clerk = {
  user?: ClerkUser | null
  session?: ClerkSession | null
  load(options: ClerkLoadOptions): Promise<void>
  // Clerk calls the listener at once and after every change, and returns a function that removes it.
  addListener(
    listener: (resources: { user?: ClerkUser | null }) => void
  ): (() => void) | void
  mountSignIn(node: HTMLDivElement, options: SignInMountOptions): void
  unmountSignIn(node: HTMLDivElement): void
  mountSignUp(node: HTMLDivElement, options: SignUpMountOptions): void
  unmountSignUp(node: HTMLDivElement): void
  signOut(options: { redirectUrl: string }): Promise<void>
}

declare global {
  interface Window {
    Clerk?: Clerk
    // Set by Clerk's UI bundle (ui.browser.js) and handed to Clerk.load.
    __internal_ClerkUICtor?: unknown
  }
}
