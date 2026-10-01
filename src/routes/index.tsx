import { createFileRoute, redirect } from '@tanstack/react-router'
import { ready } from '@/lib/auth'

// Home: a signed-in visitor goes to their recordings; everyone else to sign-in.
export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const clerk = await ready.catch(() => null)
    throw redirect({
      to: clerk?.session ? '/dashboard' : '/sign-in',
      replace: true,
    })
  },
})
