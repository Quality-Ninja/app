import { createFileRoute } from '@tanstack/react-router'
import { BAD_RUN_LINK, isRunId } from '@/lib/views'
import { ErrorView } from '@/components/ErrorView'
import { Page } from '@/components/Page'
import { RequireSignIn } from '@/components/RequireSignIn'
import { RunDetail } from '@/screens/user/execute/RunDetail'

// /execute/runs/:id, one run; #step-N points at a step. Coding agents (MCP) and the extension link here.
export const Route = createFileRoute('/_user/execute/runs/$id')({
  component: RunRoute,
})

function RunRoute() {
  const { id } = Route.useParams()
  // The address is checked before sign-in, so a malformed link explains itself.
  if (!isRunId(id))
    return (
      <Page>
        <ErrorView info={BAD_RUN_LINK} status={404} />
      </Page>
    )
  return (
    <RequireSignIn next={`/execute/runs/${id}`}>
      <RunDetail id={id} />
    </RequireSignIn>
  )
}
