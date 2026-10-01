import { useEffect, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import lockup from '@/assets/lockup.svg'
import { configured, ready } from '@/lib/auth'
import type { Clerk } from '@/lib/clerk'
import { safeNext } from '@/lib/views'
import { useAuth } from '@/hooks/useAuth'
import { useBodyClass } from '@/hooks/useBodyClass'
import { useTitle } from '@/hooks/useTitle'
import { Notice } from '@/components/Notice'

// The legacy sign-in look around Clerk's form: one page for every surface (extension, web app); ?mode=signup shows
// sign-up. Clerk comes back here after signing someone in, and the page sends them on to `next` (an allowlist).
export function SignIn({ mode, next }: { mode?: string; next?: string }) {
  const signup = mode === 'signup'
  const destination = safeNext(next ?? '/dashboard')
  const auth = useAuth()
  const navigate = useNavigate()
  useTitle(signup ? 'Join QA Ninja' : 'Sign in to QA Ninja')
  useBodyClass('auth-page')

  useEffect(() => {
    if (auth.signedIn) void navigate({ href: destination, replace: true })
  }, [auth.signedIn, destination, navigate])

  return (
    <>
      <a className='skip-link' href='#content'>
        Skip to content
      </a>
      <main id='content' className='page' tabIndex={-1}>
        {auth.status === 'unavailable' && configured ? (
          <p
            id='message'
            className='notice error'
            role='status'
            aria-live='polite'
          >
            {auth.error.message}
          </p>
        ) : (
          <Notice />
        )}
        <section
          className='auth-card'
          aria-label={
            signup ? 'Create your QA Ninja account' : 'Sign in to QA Ninja'
          }
        >
          <a className='auth-hero' href='/'>
            <img src={lockup} alt='QA Ninja home' width='250' height='250' />
          </a>
          <p className='auth-subtitle'>
            Sign in to capture, compose, and automate at the speed of your next
            click.
          </p>
          <div className='auth-panel'>
            {configured ? (
              <>
                {auth.signedIn ? null : (
                  <ClerkForm signup={signup} destination={destination} />
                )}
                {auth.status === 'unavailable' ? (
                  <button
                    type='button'
                    id='auth-retry'
                    className='quiet'
                    onClick={() => location.reload()}
                  >
                    Try again
                  </button>
                ) : null}
              </>
            ) : (
              <div id='auth-unconfigured'>
                <h1>{signup ? 'Join the Clan' : 'Log in'}</h1>
                <p className='notice error' role='alert'>
                  Sign-in is not configured yet. XPath Finder in the extension
                  remains available.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  )
}

// Clerk renders its sign-in or sign-up form into this element; it says "Loading sign-in…" until then (sign-in.css).
function ClerkForm({
  signup,
  destination,
}: {
  signup: boolean
  destination: string
}) {
  const node = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = node.current
    if (!element) return
    let active = true
    let clerk: Clerk | undefined
    ready.then(
      (loaded) => {
        if (!active) return
        clerk = loaded
        // Both views live on this page and link to each other here. Never pass signInUrl to Clerk.load without
        // signUpUrl: that turns on Clerk's combined flow, which ignores these per-view URLs.
        const here = (view = signup) =>
          '/sign-in?' +
          new URLSearchParams({
            ...(view ? { mode: 'signup' } : {}),
            next: destination,
          })
        if (signup)
          clerk.mountSignUp(element, {
            routing: 'hash',
            forceRedirectUrl: here(),
            signInForceRedirectUrl: here(),
            signInUrl: here(false),
          })
        else
          clerk.mountSignIn(element, {
            routing: 'hash',
            forceRedirectUrl: here(),
            signUpForceRedirectUrl: here(),
            signUpUrl: here(true),
          })
      },
      () => {}
    )
    return () => {
      active = false
      if (!clerk) return
      if (signup) clerk.unmountSignUp(element)
      else clerk.unmountSignIn(element)
    }
  }, [signup, destination])

  return (
    <div
      id='clerk-sign-in'
      ref={node}
      data-mode={signup ? 'signup' : 'signin'}
      data-next={destination}
    />
  )
}
