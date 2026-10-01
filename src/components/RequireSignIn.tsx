import { type ReactNode, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { safeNext } from '@/lib/views'
import { useAuth } from '@/hooks/useAuth'
import { Page } from './Page'

// Pages that need an account send signed-out visitors to sign in, and sign-in sends them back to `next`. The page
// names its own address: while the router moves to /sign-in, its location is already the new one.
export function RequireSignIn({
  next,
  children,
}: {
  next: string
  children: ReactNode
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const signedOut = auth.status !== 'loading' && !auth.signedIn

  useEffect(() => {
    if (signedOut)
      void navigate({
        to: '/sign-in',
        search: { next: safeNext(next) },
        replace: true,
      })
  }, [signedOut, next, navigate])

  return auth.signedIn ? children : <Page busy />
}
