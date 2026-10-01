import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@/screens/SignIn'

// /sign-in, /sign-in?mode=signup, and ?next= (checked against an allowlist by the screen).
type SearchParams = { mode?: string; next?: string }

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    mode: typeof search.mode === 'string' ? search.mode : undefined,
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
  component: SignInRoute,
})

function SignInRoute() {
  const { mode, next } = Route.useSearch()
  return <SignIn mode={mode} next={next} />
}
