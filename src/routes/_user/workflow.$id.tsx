import { createFileRoute } from '@tanstack/react-router'
import { BAD_LINK, isWorkflowId } from '@/lib/views'
import { ErrorView } from '@/components/ErrorView'
import { Page } from '@/components/Page'
import { RequireSignIn } from '@/components/RequireSignIn'
import { Workflow } from '@/screens/user/Workflow'

// /workflow/:id, which the extension's "Open in dashboard" links to.
export const Route = createFileRoute('/_user/workflow/$id')({
  component: WorkflowRoute,
})

function WorkflowRoute() {
  const { id } = Route.useParams()
  // The address is checked before sign-in, so a malformed link explains itself.
  if (!isWorkflowId(id))
    return (
      <Page>
        <ErrorView info={BAD_LINK} status={404} />
      </Page>
    )
  return (
    <RequireSignIn next={`/workflow/${id}`}>
      <Workflow id={id} />
    </RequireSignIn>
  )
}
