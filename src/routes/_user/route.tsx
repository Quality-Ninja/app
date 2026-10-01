import { Outlet, createFileRoute } from '@tanstack/react-router'
import { UserShell } from '@/components/UserShell'

// The pages under the site header (screens/user). The path stays as it was: /account, /dashboard, /workflow/:id.
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
