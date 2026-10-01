import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { api, download } from '@/lib/api'
import type { Capabilities, PlanSummary } from '@/lib/types'
import { useTitle } from '@/hooks/useTitle'
import { ActionButton } from '@/components/ActionButton'
import { EmptyState } from '@/components/EmptyState'
import { QueryError } from '@/components/ErrorView'
import { LocalTime } from '@/components/LocalTime'
import { Page } from '@/components/Page'
import { UsageRail } from '@/components/UsageRail'

// The signed-in user's saved recordings, newest first. They outlive a subscription for download and delete.
export function Dashboard({ deleted }: { deleted: boolean }) {
  const capabilities = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api<Capabilities>('/me/capabilities'),
  })
  const workflows = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api<PlanSummary[]>('/workflows'),
  })
  const error = capabilities.error ?? workflows.error
  useTitle(error ? null : 'Recordings · QA Ninja')
  if (error)
    return (
      <Page>
        <QueryError error={error} />
      </Page>
    )
  if (!capabilities.data || !workflows.data) return <Page busy />

  const caps = capabilities.data
  const list = workflows.data
  const paid = caps.recording
  return (
    <Page>
      <div className='page-head'>
        <h1>Recordings</h1>
        {paid ? <Usage caps={caps} /> : null}
      </div>
      {deleted ? <p className='notice'>Recording deleted.</p> : null}
      {!paid && list.length ? (
        <div className='notice'>
          <p>
            Your plan has ended. You can still download or delete these
            recordings. <Link to='/account'>See plans</Link>
          </p>
        </div>
      ) : null}
      {list.length ? (
        <ul className='recordings' role='list'>
          {list.map((item) => (
            <RecordingRow key={item.id} item={item} paid={paid} />
          ))}
        </ul>
      ) : paid ? (
        <EmptyState title='No recordings yet'>
          <p>
            In the extension, open Record, choose Dashboard under Save to, then
            finish a recording. It appears here.
          </p>
        </EmptyState>
      ) : (
        <EmptyState title='Record workflows with a paid plan'>
          <p>
            Recording turns your clicks into Playwright, Selenium, Cypress, and
            Robot Framework scripts, and saved recordings appear here. XPath
            Finder in the extension stays free for 50 inspections a day.
          </p>
          <Link className='button primary' to='/account'>
            See plans
          </Link>
        </EmptyState>
      )}
    </Page>
  )
}

function Usage({ caps }: { caps: Capabilities }) {
  if (caps.cloud_limit === null)
    return <p className='meta'>Unlimited dashboard recordings</p>
  return (
    <div className='usage'>
      <UsageRail used={caps.cloud_used} total={caps.cloud_limit} />
      <p className='meta'>
        {caps.cloud_used} of {caps.cloud_limit} dashboard recordings used
      </p>
    </div>
  )
}

function RecordingRow({ item, paid }: { item: PlanSummary; paid: boolean }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const zip = `/workflows/${item.id}/download`

  const remove = async () => {
    await api(`/workflows/${item.id}`, { method: 'DELETE' })
    queryClient.removeQueries({ queryKey: ['workflow', String(item.id)] })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workflows'] }),
      queryClient.invalidateQueries({ queryKey: ['capabilities'] }),
    ])
    await navigate({ to: '/dashboard', search: { deleted: '1' } })
    document.getElementById('content')?.focus()
  }

  return (
    <li className='recording'>
      <div>
        <h2 className='recording-name'>
          {paid ? (
            <Link to='/workflow/$id' params={{ id: String(item.id) }}>
              {item.name}
            </Link>
          ) : (
            item.name
          )}
        </h2>
        <p className='meta'>
          {item.steps} {item.steps === 1 ? 'step' : 'steps'}, saved{' '}
          <LocalTime value={item.created_at} />
        </p>
      </div>
      <div className='recording-actions'>
        <ActionButton
          className='quiet'
          data-download={zip}
          onAction={() => download(zip)}
        >
          Download ZIP<span className='sr-only'> of {item.name}</span>
        </ActionButton>
        <ActionButton
          className='quiet danger'
          data-delete={item.id}
          confirm='Permanently delete this cloud recording and its files? Local copies are kept.'
          onAction={remove}
        >
          Delete<span className='sr-only'> {item.name}</span>
        </ActionButton>
      </div>
    </li>
  )
}
