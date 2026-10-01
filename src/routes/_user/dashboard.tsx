import { createFileRoute } from '@tanstack/react-router'
import { RequireSignIn } from '@/components/RequireSignIn'
import { Dashboard } from '@/screens/user/Dashboard'

// ?deleted=1 confirms a deleted recording.
type SearchParams = { deleted?: string }

export const Route = createFileRoute('/_user/dashboard')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    deleted: typeof search.deleted === 'string' ? search.deleted : undefined,
  }),
  component: DashboardRoute,
})

function DashboardRoute() {
  const { deleted } = Route.useSearch()
  return (
    <RequireSignIn next='/dashboard'>
      <Dashboard deleted={deleted === '1'} />
    </RequireSignIn>
  )
}
