import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import {
  MODE_INFO,
  ORIGINS,
  type TimelineStep,
  agentText,
  blockedText,
  errorsByStep,
  formatCost,
  formatDuration,
  isActive,
  locatorText,
  progressText,
  rerunBrain,
  resolutionText,
  runTimeline,
  stepsText,
  tokensText,
} from '@/lib/execute'
import type {
  Capabilities,
  RunArtifact,
  RunDetail as Run,
  RunSummary,
} from '@/lib/types'
import { useTitle } from '@/hooks/useTitle'
import { useToast } from '@/hooks/useToast'
import { ActionButton } from '@/components/ActionButton'
import { QueryError } from '@/components/ErrorView'
import { LocalTime } from '@/components/LocalTime'
import { Page } from '@/components/Page'
import { Screenshot } from '@/components/Screenshot'
import { StatusPill, StepStatusPill } from '@/components/StatusPill'
import { VerdictBadge } from '@/components/VerdictBadge'
import { BackIcon } from '@/components/icons'
import { RunButton } from './RunButton'
import { Transcript } from './Transcript'

// One run: how it ended and why, who ran it and what it cost, each step beside its recorded screenshot, the errors
// the page logged, and the agent's transcript. It follows a queued or running run every 3 seconds.
export function RunDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const run = useQuery({
    queryKey: ['execute', 'run', id],
    queryFn: () => api<Run>(`/execute/runs/${id}`),
    refetchInterval: (query) =>
      isActive(query.state.data?.status) ? 3000 : false,
  })
  const capabilities = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api<Capabilities>('/me/capabilities'),
  })
  const data = run.data
  useTitle(
    run.error ? null : data ? `${data.name} run · QA Ninja` : 'Run · QA Ninja'
  )
  const target = useLocation({
    select: (location) => /^step-([1-9][0-9]*)$/.exec(location.hash)?.[1],
  })

  // A linked step (#step-N) only exists once the run has loaded, so scroll to it then.
  const loaded = Boolean(data)
  useEffect(() => {
    if (loaded && target)
      document
        .getElementById(`step-${target}`)
        ?.scrollIntoView({ block: 'start' })
  }, [loaded, target])

  // When a run this page followed ends, the lists that show it (and the included runs) are out of date.
  const status = data?.status
  const followed = useRef(false)
  useEffect(() => {
    if (!status) return
    if (isActive(status)) followed.current = true
    else if (followed.current) {
      followed.current = false
      void queryClient.invalidateQueries({ queryKey: ['execute', 'runs'] })
      void queryClient.invalidateQueries({ queryKey: ['execute', 'tests'] })
      void queryClient.invalidateQueries({ queryKey: ['capabilities'] })
    }
  }, [status, queryClient])

  if (run.error)
    return (
      <Page>
        <QueryError error={run.error} run />
      </Page>
    )
  if (!data) return <Page busy />

  const timeline = runTimeline(data.spec, data.steps)
  const failing =
    data.failing_step === null
      ? undefined
      : timeline.find((item) => item.index === data.failing_step)
  const caps = capabilities.data
  const progress = progressText(data)
  const duration = formatDuration(data.duration_ms)
  return (
    <Page>
      <Link className='back-link' to='/execute' search={{ tab: 'runs' }}>
        <BackIcon />
        Runs
      </Link>
      <div className='page-head run-head'>
        <div>
          <p className='run-badges'>
            {data.verdict ? <VerdictBadge verdict={data.verdict} /> : null}
            <StatusPill status={data.status} />
          </p>
          <h1>{data.name}</h1>
          <p className='meta'>
            {MODE_INFO[data.mode].label} run · {ORIGINS[data.origin]}
            {data.created_at ? (
              <>
                {' · '}
                <LocalTime value={data.created_at} />
              </>
            ) : null}
          </p>
        </div>
        <RunActions run={data} caps={caps} />
      </div>
      <div className='run-outcome' aria-live='polite'>
        {data.summary ? <p className='lede'>{data.summary}</p> : null}
        {data.verdict === 'BLOCKED' && data.blocked_reason ? (
          <p data-blocked-reason={data.blocked_reason}>
            Blocked: {blockedText(data.blocked_reason)}
          </p>
        ) : null}
        {progress ? <p>{progress}</p> : null}
        {failing ? (
          <p className='run-failing'>
            {data.verdict === 'BLOCKED' ? 'Stopped at ' : 'Failed at '}
            <Link
              to='/execute/runs/$id'
              params={{ id: data.id }}
              hash={`step-${failing.index + 1}`}
            >
              step {failing.index + 1}: {failing.label}
            </Link>
          </p>
        ) : null}
      </div>
      <dl className='facts run-facts'>
        <dt>Agent</dt>
        <dd>{agentText(data)}</dd>
        <dt>Steps</dt>
        <dd>{stepsText(data)}</dd>
        <dt>Duration</dt>
        <dd>{duration || (data.started_at ? '…' : 'Not started')}</dd>
        {data.usage.model_calls ? (
          <>
            <dt>Cost</dt>
            <dd>
              {formatCost(data.usage.cost_usd)} ·{' '}
              {data.usage.model_calls === 1
                ? '1 model call'
                : `${data.usage.model_calls} model calls`}
            </dd>
            <dt>Tokens</dt>
            <dd>{tokensText(data.usage)}</dd>
          </>
        ) : null}
        {data.spec.start_url ? (
          <>
            <dt>Start page</dt>
            <dd className='run-start-url'>{data.spec.start_url}</dd>
          </>
        ) : null}
      </dl>
      <section aria-labelledby='steps-title'>
        <h2 id='steps-title'>Steps</h2>
        {timeline.length ? (
          <ol className='step-list run-steps'>
            {timeline.map((item) => (
              <RunStepItem
                key={item.index}
                run={data}
                item={item}
                current={target === String(item.index + 1)}
                failing={item === failing}
                // The recorded screenshot comes from the recording, which needs an active plan.
                recorded={Boolean(caps?.recording)}
                canAccept={Boolean(caps?.execute)}
              />
            ))}
          </ol>
        ) : (
          <p className='meta'>No steps yet.</p>
        )}
      </section>
      <RunErrors run={data} timeline={timeline} />
      <Transcript run={data} />
    </Page>
  )
}

// Stop a live run; run a finished one again, keep a passing agent run's path, or delete it.
function RunActions({ run, caps }: { run: Run; caps?: Capabilities }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const toast = useToast()
  const active = isActive(run.status)
  const brain = rerunBrain(run)
  const workflowId = run.workflow_id
  const canRun = Boolean(caps?.execute)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['execute', 'run', run.id] })

  const cancel = async () => {
    const updated = await api<RunSummary>(`/execute/runs/${run.id}/cancel`, {
      method: 'POST',
    })
    await refresh()
    void queryClient.invalidateQueries({ queryKey: ['execute', 'runs'] })
    toast(
      updated.status === 'cancelled' ? 'Run cancelled' : 'Stopping the run',
      run.name
    )
  }

  const saveTrace = async () => {
    if (workflowId === null) return
    const saved = await api<{ steps: number }>(
      `/execute/tests/${workflowId}/trace`,
      { method: 'POST', body: { run_id: run.id } }
    )
    void queryClient.invalidateQueries({ queryKey: ['execute', 'tests'] })
    void queryClient.invalidateQueries({
      queryKey: ['execute', 'test', workflowId],
    })
    toast(
      'Saved as the replay path',
      `${saved.steps} ${saved.steps === 1 ? 'step' : 'steps'}`
    )
  }

  const remove = async () => {
    await api(`/execute/runs/${run.id}`, { method: 'DELETE' })
    queryClient.removeQueries({ queryKey: ['execute', 'run', run.id] })
    void queryClient.invalidateQueries({ queryKey: ['execute'] })
    toast('Run deleted', run.name)
    await navigate({ to: '/execute', search: { tab: 'runs' } })
  }

  return (
    <div className='run-actions'>
      {active ? (
        <ActionButton
          className='danger'
          disabled={run.cancel_requested}
          onAction={cancel}
        >
          {run.status === 'queued' ? 'Cancel run' : 'Stop run'}
        </ActionButton>
      ) : null}
      {!active && canRun && workflowId !== null && brain ? (
        <RunButton
          label='Run again'
          prepare={async () => ({
            workflow_id: workflowId,
            origin: 'dashboard',
            mode: run.mode,
            brain,
          })}
        />
      ) : null}
      {canRun &&
      run.mode === 'agent' &&
      run.verdict === 'PASSED' &&
      workflowId !== null ? (
        <ActionButton onAction={saveTrace}>Save as replay path</ActionButton>
      ) : null}
      {!active ? (
        <ActionButton
          className='quiet danger'
          confirm="Delete this run and its screenshots? This can't be undone."
          onAction={remove}
        >
          Delete run
        </ActionButton>
      ) : null}
    </div>
  )
}

// A run's newest screenshot of a step, for steps whose result doesn't name one.
function stepShot(artifacts: RunArtifact[], index: number) {
  let id: string | undefined
  for (const artifact of artifacts)
    if (artifact.kind === 'screenshot' && artifact.step_index === index)
      id = artifact.id
  return id
}

// One step on the trail: how it went and how long it took, any error, the agent's fix to accept, and the recorded
// screenshot beside this run's. The failing step is marked; a #step-N link makes a step the target.
function RunStepItem({
  run,
  item,
  current,
  failing,
  recorded,
  canAccept,
}: {
  run: Run
  item: TimelineStep
  current: boolean
  failing: boolean
  recorded: boolean
  canAccept: boolean
}) {
  const n = item.index + 1
  const result = item.result
  const status = result?.status ?? 'pending'
  const shot =
    result?.screenshot_artifact_id ?? stepShot(run.artifacts, item.index)
  const recordedPath =
    recorded && run.workflow_id !== null && item.recordedShot
      ? `/workflows/${run.workflow_id}/preview/${item.recordedShot}`
      : null
  const meta = result
    ? [
        resolutionText(result.resolution),
        // The agent's own finds are already said by the resolution.
        result.locator_used && result.locator_used !== 'agent'
          ? `found by ${result.locator_used}`
          : '',
        formatDuration(result.duration_ms),
      ].filter(Boolean)
    : []
  return (
    <li
      id={`step-${n}`}
      className='step run-step'
      data-status={status}
      data-failing={failing || undefined}
      aria-current={current ? 'step' : undefined}
    >
      <div className='run-step-head'>
        <h3 className='step-label'>{item.label}</h3>
        <StepStatusPill status={status} />
      </div>
      {item.url ? (
        <p className='step-url meta' title={item.url}>
          {item.url}
        </p>
      ) : null}
      {meta.length ? (
        <p className='step-meta meta'>{meta.join(' · ')}</p>
      ) : null}
      {result?.error_code || result?.error_message ? (
        <p className='step-error'>
          {result.error_code ? <code>{result.error_code}</code> : null}
          {result.error_code && result.error_message ? ' ' : null}
          {result.error_message}
        </p>
      ) : null}
      {status === 'healed' ? (
        <HealedStep
          run={run}
          n={n}
          index={item.index}
          label={item.label}
          locator={locatorText(result?.locator ?? null)}
          canAccept={canAccept && run.workflow_id !== null}
        />
      ) : null}
      {recordedPath || shot ? (
        <div className='shot-pair'>
          <figure>
            <figcaption>Recorded</figcaption>
            {recordedPath ? (
              <Screenshot
                path={recordedPath}
                alt={`Step ${n} as recorded: ${item.label}`}
              />
            ) : (
              <p className='shot-missing'>No screenshot</p>
            )}
          </figure>
          <figure>
            <figcaption>This run</figcaption>
            {shot ? (
              <Screenshot
                path={`/execute/runs/${run.id}/artifacts/${shot}`}
                alt={`Step ${n} in this run: ${item.label}`}
              />
            ) : (
              <p className='shot-missing'>No screenshot</p>
            )}
          </figure>
        </div>
      ) : null}
    </li>
  )
}

// The agent found this step another way. Accepting makes that the step's first locator from now on.
function HealedStep({
  run,
  n,
  index,
  label,
  locator,
  canAccept,
}: {
  run: Run
  n: number
  index: number
  label: string
  locator: string
  canAccept: boolean
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [accepted, setAccepted] = useState(false)
  const accept = async () => {
    await api(`/execute/tests/${run.workflow_id}/heals`, {
      method: 'POST',
      body: { run_id: run.id, step_index: index },
    })
    setAccepted(true)
    void queryClient.invalidateQueries({ queryKey: ['execute', 'tests'] })
    void queryClient.invalidateQueries({
      queryKey: ['execute', 'test', run.workflow_id],
    })
    toast('Fix accepted', `Step ${n}: ${label}`)
  }
  return (
    <div className='heal'>
      <p className='meta'>
        The recorded locator didn't work, so the agent found this step another
        way{locator ? ':' : '.'}
      </p>
      {locator ? (
        <div className='well'>
          <code>{locator}</code>
        </div>
      ) : null}
      {accepted ? (
        <p className='meta heal-accepted'>
          Fix accepted: later runs replay this step the new way.
        </p>
      ) : canAccept ? (
        <ActionButton className='compact' data-accept={index} onAction={accept}>
          Accept fix<span className='sr-only'> for step {n}</span>
        </ActionButton>
      ) : null}
    </div>
  )
}

// Console, exception, and network errors from the page, by the step they happened in.
function RunErrors({ run, timeline }: { run: Run; timeline: TimelineStep[] }) {
  const groups = errorsByStep(run.events)
  const labels = new Map(timeline.map((item) => [item.index, item.label]))
  return (
    <section aria-labelledby='errors-title'>
      <h2 id='errors-title'>Console and network errors</h2>
      {groups.length ? (
        <div className='event-groups'>
          {groups.map((group) => (
            <div key={group.step ?? 'run'} className='event-group'>
              <h3>
                {group.step === null ? (
                  'Outside the steps'
                ) : (
                  <Link
                    to='/execute/runs/$id'
                    params={{ id: run.id }}
                    hash={`step-${group.step + 1}`}
                  >
                    Step {group.step + 1}
                    {labels.get(group.step)
                      ? `: ${labels.get(group.step)}`
                      : ''}
                  </Link>
                )}
              </h3>
              <ul className='events' role='list'>
                {group.events.map((event) => (
                  <li key={event.client_seq} className='event'>
                    <span className='event-kind'>{event.kind}</span>
                    <code>{event.message}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className='meta'>
          {isActive(run.status) ? 'None so far.' : 'None reported.'}
        </p>
      )}
    </section>
  )
}
