import { createFileRoute } from '@tanstack/react-router'
import { isExecuteTab } from '@/lib/execute'
import { stringifySearch } from '@/lib/search'
import { isWorkflowId } from '@/lib/views'
import { RequireSignIn } from '@/components/RequireSignIn'
import { Execute } from '@/screens/user/execute/Execute'

// /execute: run tests (?tab=run, the default; ?test= picks one), their history (?tab=runs), and agents (?tab=agents).
type SearchParams = { tab?: string; test?: string }

export const Route = createFileRoute('/_user/execute/')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
    test: typeof search.test === 'string' ? search.test : undefined,
  }),
  component: ExecuteRoute,
})

function ExecuteRoute() {
  const { tab, test } = Route.useSearch()
  const current = isExecuteTab(tab) ? tab : 'run'
  // Sign-in returns to the tab (an allowlist in views.ts), not to a test.
  const next =
    '/execute' + stringifySearch({ tab: isExecuteTab(tab) ? tab : undefined })
  return (
    <RequireSignIn next={next}>
      <Execute
        tab={current}
        test={test && isWorkflowId(test) ? test : undefined}
      />
    </RequireSignIn>
  )
}
