import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import {
  type BrainChoice,
  MODES,
  MODE_INFO,
  type SettingsForm,
  brainChoices,
  pickBrain,
  pickMode,
  sameSettings,
  secretsText,
  settingsBody,
  settingsErrors,
  settingsForm,
} from '@/lib/execute'
import type {
  AgentConnection,
  Capabilities,
  ExecuteTest,
  RecordedInput,
  StartRunBody,
  TestDetail,
  TestSettings,
  TestSettingsBody,
} from '@/lib/types'
import { useExtension } from '@/hooks/useExtension'
import { useToast } from '@/hooks/useToast'
import { ActionButton } from '@/components/ActionButton'
import { EmptyState } from '@/components/EmptyState'
import { QueryError } from '@/components/ErrorView'
import { LocalTime } from '@/components/LocalTime'
import { StatusPill } from '@/components/StatusPill'
import { UsageRail } from '@/components/UsageRail'
import { VerdictBadge } from '@/components/VerdictBadge'
import { RunButton } from './RunButton'
import { RunRow } from './RunRow'
import { type ChangeForm, SettingsFields } from './SettingsFields'

// Run a test: the saved recordings as tests on the trail, and the chosen one's agent, mode, and settings, with "Run
// on this computer". Without ?test=, the newest test is open.
export function RunTab({ caps, test }: { caps: Capabilities; test?: string }) {
  const tests = useQuery({
    queryKey: ['execute', 'tests'],
    queryFn: () => api<ExecuteTest[]>('/execute/tests'),
  })
  if (tests.error) return <QueryError error={tests.error} />
  if (!tests.data) return <div aria-busy='true' />

  const list = tests.data
  if (!list.length)
    return (
      <EmptyState title='No tests yet'>
        <p>
          Every recording you save to the dashboard can run here as a test. In
          the extension, open Record, choose Dashboard under Save to, then
          finish a recording.
        </p>
      </EmptyState>
    )
  const selected = list.find((item) => String(item.id) === test) ?? list[0]
  return (
    <div className='run-layout'>
      <nav className='test-nav' aria-label='Tests'>
        <ul className='test-list' role='list'>
          {list.map((item) => (
            <TestRow
              key={item.id}
              item={item}
              selected={item.id === selected.id}
            />
          ))}
        </ul>
      </nav>
      <TestPanel key={selected.id} caps={caps} test={selected} />
    </div>
  )
}

// A test on the trail: its name, steps, and how its last run went. The open test is the waypoint.
function TestRow({ item, selected }: { item: ExecuteTest; selected: boolean }) {
  const last = item.last_run
  return (
    <li className='test-item' data-selected={selected || undefined}>
      <Link
        className='test-link'
        to='/execute'
        search={{ tab: 'run', test: String(item.id) }}
        aria-current={selected ? 'true' : undefined}
      >
        <span className='test-name'>{item.name}</span>
        <span className='meta'>
          {item.steps} {item.steps === 1 ? 'step' : 'steps'}
          {last?.created_at ? (
            <>
              {' · last run '}
              <LocalTime value={last.created_at} />
            </>
          ) : (
            ' · not run yet'
          )}
        </span>
      </Link>
      {last ? (
        last.verdict ? (
          <VerdictBadge verdict={last.verdict} />
        ) : (
          <StatusPill status={last.status} />
        )
      ) : null}
    </li>
  )
}

function TestPanel({ caps, test }: { caps: Capabilities; test: ExecuteTest }) {
  const connections = useQuery({
    queryKey: ['execute', 'connections'],
    queryFn: () => api<AgentConnection[]>('/execute/connections'),
  })
  const detail = useQuery({
    queryKey: ['execute', 'test', test.id],
    queryFn: () => api<TestDetail>(`/execute/tests/${test.id}`),
  })
  const error = connections.error ?? detail.error
  if (error) return <QueryError error={error} />
  return (
    <section className='test-panel' aria-labelledby='test-title'>
      <div className='test-head'>
        <h2 id='test-title'>{test.name}</h2>
        <p className='meta'>
          {test.steps} {test.steps === 1 ? 'step' : 'steps'}
          {test.start_url ? ` · starts at ${test.start_url}` : ''} · recorded{' '}
          <LocalTime value={test.created_at} />
        </p>
      </div>
      {connections.data ? (
        <TestForm caps={caps} test={test} connections={connections.data} />
      ) : (
        <div aria-busy='true' />
      )}
      {detail.data ? <TestSteps test={detail.data} /> : null}
      {detail.data?.recent_runs.length ? (
        <section aria-labelledby='recent-title'>
          <h3 id='recent-title'>Recent runs</h3>
          <ul className='run-list' role='list'>
            {detail.data.recent_runs.map((run) => (
              <RunRow key={run.id} run={run} heading='h4' />
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  )
}

// The saved settings (with the recording's own inputs), and the agent and mode set to ones that can run now: a removed
// connection, or a QA Ninja Agent that isn't available, falls back to another agent.
function usableForm(
  settings: TestSettingsBody,
  choices: BrainChoice[],
  recorded: RecordedInput[]
) {
  const form = settingsForm(settings, recorded)
  const brain = pickBrain(form.default_brain, choices)
  return {
    ...form,
    default_brain: brain,
    default_mode: pickMode(form.default_mode, brain),
  }
}

// The test's agent, mode, and settings, saved together as its defaults. Running saves changes first, so a run uses
// what's on screen.
function TestForm({
  caps,
  test,
  connections,
}: {
  caps: Capabilities
  test: ExecuteTest
  connections: AgentConnection[]
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const choices = brainChoices(caps, connections)
  const [baseline, setBaseline] = useState(() =>
    usableForm(test.settings, choices, test.inputs)
  )
  const [form, setForm] = useState<SettingsForm>(baseline)
  // Field problems show once a save has been tried.
  const [tried, setTried] = useState(false)
  const errors = settingsErrors(form)
  const body = settingsBody(form)
  const dirty = !sameSettings(body, settingsBody(baseline))

  const change: ChangeForm = (recipe) =>
    setForm((current) => ({ ...current, ...recipe(current) }))

  const save = async () => {
    setTried(true)
    if (Object.keys(errors).length)
      throw new Error('Check the highlighted settings, then try again.')
    const saved = await api<TestSettings>(
      `/execute/tests/${test.id}/settings`,
      { method: 'PUT', body }
    )
    const next = usableForm(saved, choices, test.inputs)
    setBaseline(next)
    setForm(next)
    setTried(false)
    queryClient.setQueryData<ExecuteTest[]>(['execute', 'tests'], (list) =>
      list?.map((item) =>
        item.id === test.id ? { ...item, settings: saved } : item
      )
    )
    // The test's secrets merge the recording's with the settings', so they come back from the API.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['execute', 'tests'] }),
      queryClient.invalidateQueries({ queryKey: ['execute', 'test', test.id] }),
    ])
    toast('Settings saved', test.name)
  }

  const prepare = async (): Promise<StartRunBody> => {
    if (dirty) await save()
    return {
      workflow_id: test.id,
      origin: 'dashboard',
      mode: pickMode(form.default_mode, form.default_brain),
      brain: form.default_brain,
      base_url: body.base_url,
      inputs: body.inputs,
    }
  }

  return (
    <form
      className='test-form'
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <div className='choice-groups'>
        <fieldset className='choices' aria-describedby='agent-hint'>
          <legend>Agent</legend>
          <p id='agent-hint' className='field-hint'>
            Who steps in when a step needs judgment.{' '}
            <Link to='/execute' search={{ tab: 'agents' }}>
              Manage agents
            </Link>
          </p>
          {choices.map((choice) => (
            <label
              key={choice.value}
              className='choice'
              data-brain={choice.value}
            >
              <input
                type='radio'
                name='brain'
                value={choice.value}
                checked={form.default_brain === choice.value}
                disabled={choice.disabled}
                onChange={() =>
                  change((current) => ({
                    default_brain: choice.value,
                    default_mode: pickMode(current.default_mode, choice.value),
                  }))
                }
              />
              <span className='choice-text'>
                <span className='choice-title'>{choice.title}</span>
                <span className='choice-detail'>{choice.detail}</span>
                {choice.value === 'managed' &&
                caps.execute_managed_limit > 0 ? (
                  <UsageRail
                    used={caps.execute_managed_used}
                    total={caps.execute_managed_limit}
                  />
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className='choices'>
          <legend>Mode</legend>
          {MODES.map((mode) => (
            <label key={mode} className='choice' data-mode={mode}>
              <input
                type='radio'
                name='mode'
                value={mode}
                checked={form.default_mode === mode}
                disabled={mode !== 'replay' && form.default_brain === 'none'}
                onChange={() => change(() => ({ default_mode: mode }))}
              />
              <span className='choice-text'>
                <span className='choice-title'>{MODE_INFO[mode].label}</span>
                <span className='choice-detail'>{MODE_INFO[mode].detail}</span>
              </span>
            </label>
          ))}
          {form.default_brain === 'none' ? (
            <p className='field-hint'>
              Choose an agent for assisted and agent runs.
            </p>
          ) : null}
        </fieldset>
      </div>
      <div className='run-start'>
        <RunButton prepare={prepare} />
        <ExtensionStatus />
        {dirty ? (
          <p className='meta'>Your changes are saved when the run starts.</p>
        ) : null}
        {test.secrets.length ? (
          <p className='meta run-secrets' data-secrets=''>
            This test needs: {secretsText(test.secrets)}. Enter secrets in the
            QA Ninja extension; they stay in your browser.
          </p>
        ) : null}
      </div>
      <section className='settings' aria-labelledby='settings-title'>
        <h3 id='settings-title'>Test settings</h3>
        <SettingsFields
          form={form}
          change={change}
          errors={tried ? errors : {}}
          recordedOrigin={test.origins[0] ?? ''}
        />
        <div className='row'>
          <ActionButton data-save-settings='' onAction={save}>
            Save settings
          </ActionButton>
          {dirty ? <span className='meta'>Unsaved changes</span> : null}
        </div>
      </section>
    </form>
  )
}

// Whether this browser can run tests, before anyone presses Run (which checks again).
function ExtensionStatus() {
  const { data: extension } = useExtension()
  if (extension === undefined) return null
  const text =
    extension === null
      ? 'Runs need the QA Ninja extension in this Chrome.'
      : !extension.execute
        ? 'Update the QA Ninja extension to run tests from here.'
        : !extension.signedIn
          ? 'Log in to the QA Ninja extension to run tests.'
          : `Runs in a new Chrome window, through the QA Ninja extension${extension.version ? ` ${extension.version}` : ''}.`
  return (
    <p className='meta' data-extension={extension ? 'found' : 'missing'}>
      {text}
    </p>
  )
}

// The recorded steps, which steps replay an accepted fix, and the saved replay path agent runs follow.
function TestSteps({ test }: { test: TestDetail }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['execute', 'test', test.id] }),
      queryClient.invalidateQueries({ queryKey: ['execute', 'tests'] }),
    ])
  const fixes = test.settings.healed_steps
  return (
    <section className='test-steps' aria-labelledby='test-steps-title'>
      <h3 id='test-steps-title'>Steps</h3>
      <ol className='step-list test-step-list'>
        {test.steps.map((step) => (
          <li key={step.index} className='step'>
            <h4 className='step-label'>{step.label || 'Click'}</h4>
            <p className='meta'>
              {step.description}
              {step.healed ? ' · replays an accepted fix' : ''}
            </p>
          </li>
        ))}
      </ol>
      {fixes ? (
        <div className='row'>
          <p className='meta'>
            {fixes} accepted {fixes === 1 ? 'fix' : 'fixes'}: those steps replay
            the way the agent found them.
          </p>
          <ActionButton
            className='quiet'
            confirm='Clear the accepted fixes? Those steps replay as recorded again.'
            onAction={async () => {
              await api(`/execute/tests/${test.id}/heals`, { method: 'DELETE' })
              await refresh()
              toast('Accepted fixes cleared', test.name)
            }}
          >
            Clear accepted fixes
          </ActionButton>
        </div>
      ) : null}
      {test.settings.has_trace ? (
        <div className='row'>
          <p className='meta'>
            Agent runs follow a replay path saved from a passing run.
          </p>
          <ActionButton
            className='quiet'
            confirm='Clear the saved replay path? Agent runs follow the recording again.'
            onAction={async () => {
              await api(`/execute/tests/${test.id}/trace`, { method: 'DELETE' })
              await refresh()
              toast('Replay path cleared', test.name)
            }}
          >
            Clear replay path
          </ActionButton>
        </div>
      ) : null}
    </section>
  )
}
