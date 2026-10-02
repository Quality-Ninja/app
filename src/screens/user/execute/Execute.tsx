import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { EXECUTE_TABS, type ExecuteTab } from '@/lib/execute'
import type { Capabilities } from '@/lib/types'
import { useTitle } from '@/hooks/useTitle'
import { QueryError } from '@/components/ErrorView'
import { Page } from '@/components/Page'
import { SubTabs } from '@/components/SubTabs'
import { AgentsTab } from './AgentsTab'
import { ExecuteGate } from './ExecuteGate'
import { RunTab } from './RunTab'
import { RunsTab } from './RunsTab'

// Execute: run recorded tests in this Chrome through the extension, with an agent or as a replay. Running and agents
// need a paid plan; the history stays readable without one, like saved recordings.
export function Execute({ tab, test }: { tab: ExecuteTab; test?: string }) {
  const navigate = useNavigate()
  const capabilities = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api<Capabilities>('/me/capabilities'),
  })
  useTitle(capabilities.error ? null : 'Execute · QA Ninja')
  if (capabilities.error)
    return (
      <Page>
        <QueryError error={capabilities.error} />
      </Page>
    )
  if (!capabilities.data) return <Page busy />

  const caps = capabilities.data
  return (
    <Page>
      <div className='page-head'>
        <div>
          <h1>Execute</h1>
          <p className='meta'>
            Run your recorded tests in this Chrome, with an AI agent or as a
            plain replay.
          </p>
        </div>
      </div>
      <SubTabs
        id='execute'
        label='Execute'
        tabs={EXECUTE_TABS}
        current={tab}
        onSelect={(next) =>
          void navigate({ to: '/execute', search: { tab: next } })
        }
      />
      <div
        role='tabpanel'
        id='execute-panel'
        className='tab-panel'
        aria-labelledby={`execute-tab-${tab}`}
      >
        {tab === 'runs' ? (
          <RunsTab caps={caps} />
        ) : !caps.execute ? (
          <ExecuteGate caps={caps} />
        ) : tab === 'agents' ? (
          <AgentsTab caps={caps} />
        ) : (
          <RunTab caps={caps} test={test} />
        )}
      </div>
    </Page>
  )
}
