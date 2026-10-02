import { Outlet, createFileRoute } from '@tanstack/react-router'
import { UserShell } from '@/components/UserShell'

// The pages under the site header (screens/user). The path stays as it was: /account, /dashboard, /workflow/:id, and
// Execute's /execute, /execute/runs/:id, and /execute/connect/openrouter.
export const Route = createFileRoute('/_user')({
  component: UserLayout,
})

function UserLayout() {
  return (
    <UserShell>
      <Outlet />
    </UserShell>
  )
}
