// Execute's presentation rules: the words for runs, steps and agents, durations and costs, which agents and modes a
// run can use, the test settings form both ways, and what the extension's answers mean. Pure, so execute.test.ts
// covers them; the screens live in screens/user/execute/.
import type {
  AgentConnection,
  Assertion,
  AssertionType,
  Capabilities,
  Provider,
  RecordedInput,
  RunEvent,
  RunMode,
  RunSpec,
  RunStatus,
  RunStep,
  RunSummary,
  RunUsage,
  SecretName,
  StepStatus,
  TestSettingsBody,
  ToolCallEntry,
  Verdict,
} from './types'
import { stepTitle } from './views'

// The Execute page's tabs (?tab=); a missing or unknown one shows the first.
export const EXECUTE_TABS = [
  { value: 'run', label: 'Run a test' },
  { value: 'runs', label: 'Runs' },
  { value: 'agents', label: 'Agents' },
] as const

export type ExecuteTab = (typeof EXECUTE_TABS)[number]['value']

export const isExecuteTab = (value: unknown): value is ExecuteTab =>
  EXECUTE_TABS.some((tab) => tab.value === value)

export const MODES: RunMode[] = ['replay', 'assisted', 'agent']

export const MODE_INFO: Record<RunMode, { label: string; detail: string }> = {
  replay: {
    label: 'Replay',
    detail: 'The recorded steps, exactly as recorded.',
  },
  assisted: {
    label: 'Assisted',
    detail: 'Replay; the agent fixes broken steps and judges the outcome.',
  },
  agent: {
    label: 'Agent',
    detail:
      'Goal-driven: the agent works toward the goal, guided by the recording.',
  },
}

export const VERDICTS: Record<Verdict, string> = {
  PASSED: 'Passed',
  FAILED: 'Failed',
  BLOCKED: 'Blocked',
}

export const STATUSES: Record<RunStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  error: 'Error',
  cancelled: 'Cancelled',
}

export const STEP_STATUSES: Record<StepStatus | 'pending', string> = {
  passed: 'Passed',
  healed: 'Healed',
  failed: 'Failed',
  skipped: 'Skipped',
  blocked: 'Blocked',
  pending: 'Not run',
}

const RESOLUTIONS: Record<string, string> = {
  replay: 'Replayed',
  agent: 'Fixed by the agent',
  user: 'Done by you',
  mcp: 'Done by a coding agent',
}

export const PROVIDERS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  openrouter: 'OpenRouter',
  chatgpt: 'ChatGPT',
}

export const ASSERTIONS: Record<AssertionType, string> = {
  url_contains: 'Address contains',
  text_visible: 'Page shows text',
  title_contains: 'Title contains',
}

// Why a run ended BLOCKED (api/src/execute/routes.py BLOCKED_REASONS).
const BLOCKED_REASONS: Record<string, string> = {
  login_required: 'The site asked for a login.',
  captcha: 'A CAPTCHA appeared.',
  two_factor: 'The site asked for a two-factor code.',
  missing_secret: 'A secret the test needs was not provided.',
  missing_input: 'An input the test needs was not provided.',
  navigation_blocked: 'The run tried to leave the allowed origins.',
  popup_required: 'The site needed a pop-up window.',
  file_upload_required: 'The site needed a file upload.',
  http_auth_required: 'The site asked for an HTTP sign-in.',
  step_not_found: "A recorded step couldn't be found on the page.",
  environment_error: 'The site or the browser failed.',
  budget_exhausted: 'The agent used its budget for this run.',
  agent_stuck: 'The agent got stuck.',
  model_refused: 'The model declined to continue.',
  agent_unavailable: 'The agent was unavailable.',
  connection_invalid: 'The agent connection stopped working. Reconnect it.',
  managed_quota: "This month's QA Ninja Agent runs are used up.",
  runner_restarted: 'The browser restarted during the run.',
  other: 'Something else stopped the run.',
}

// How a run ended with an error or without starting (store.py, routes.py).
const RUN_ERRORS: Record<string, string> = {
  runner_disconnected: 'The browser running it stopped responding.',
  not_started: "The extension didn't start it within 15 minutes.",
  cancelled_by_user: 'You cancelled it.',
}

const PHASES: Record<string, string> = {
  replaying: 'Replaying',
  recovering: 'The agent is fixing a step',
  verifying: 'The agent is checking the outcome',
  agent: 'The agent is working',
  waiting_for_user: 'Waiting for you in the run window',
  paused: 'Paused',
}

// An agent episode: one short conversation for one task (brain.py).
export const EPISODE_KINDS: Record<string, string> = {
  recover: 'Fixing a step',
  data: 'Filling in data',
  verify: 'Checking the outcome',
  agent: 'Working toward the goal',
}

export const EPISODE_STATUSES: Record<string, string> = {
  open: 'In progress',
  step_done: 'Step done',
  verdict: 'Gave a verdict',
  exhausted: 'Out of budget',
  error: 'Error',
}

export const ORIGINS: Record<string, string> = {
  extension: 'Started in the extension',
  dashboard: 'Started from the dashboard',
  mcp_local: 'Started by a coding agent',
  mcp_remote: 'Started by a coding agent (remote)',
}

export const isActive = (status: RunStatus | undefined) =>
  status === 'queued' || status === 'running'

export const providerName = (provider: string) =>
  PROVIDERS[provider as Provider] ?? provider

export const blockedText = (reason: string | null) =>
  reason ? (BLOCKED_REASONS[reason] ?? reason) : ''

export const runErrorText = (error: string) => RUN_ERRORS[error] ?? error

export const resolutionText = (resolution: string) =>
  RESOLUTIONS[resolution] ?? ''

// Who decided the run's steps.
export function agentName(run: Pick<RunSummary, 'brain' | 'provider'>): string {
  switch (run.brain) {
    case 'none':
      return 'Replay only'
    case 'managed':
      return 'QA Ninja Agent'
    case 'byok':
      return `${providerName(run.provider)} (your key)`
    case 'oauth':
      return providerName(run.provider)
    case 'mcp':
      return 'Coding agent'
  }
}

export const agentText = (
  run: Pick<RunSummary, 'brain' | 'provider' | 'model'>
) => [agentName(run), run.model].filter(Boolean).join(' · ')

// What a queued or running run is doing now; how a finished one ended when it didn't complete.
export function progressText(run: RunSummary): string {
  if (run.status === 'queued')
    return run.requires_approval
      ? 'Waiting for your approval in the extension'
      : 'Waiting for the extension to start it'
  if (run.status === 'running') {
    if (run.cancel_requested) return 'Stopping'
    const doing = PHASES[run.phase] ?? 'Running'
    return run.current_step === null || !run.steps_total
      ? doing
      : `${doing}: step ${Math.min(run.current_step + 1, run.steps_total)} of ${run.steps_total}`
  }
  if (run.status === 'error' || run.status === 'cancelled')
    return run.error ? runErrorText(run.error) : ''
  return ''
}

export function stepsText(
  run: Pick<RunSummary, 'steps_passed' | 'steps_total' | 'healed_steps'>
) {
  const passed = `${run.steps_passed} of ${run.steps_total} ${run.steps_total === 1 ? 'step' : 'steps'} passed`
  return run.healed_steps ? `${passed}, ${run.healed_steps} healed` : passed
}

export function formatDuration(ms: number | null) {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return ''
  if (ms < 10_000) return `${Math.round(ms / 100) / 10}s`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

// Dollars, to the cent from $1, and to four places below it (model calls cost fractions of a cent).
export function formatCost(usd: number) {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  return `$${usd.toFixed(4).replace(/(\.\d{2}\d*?)0+$/, '$1')}`
}

export const formatCount = (value: number) => value.toLocaleString('en-US')

export function tokensText(usage: RunUsage) {
  const parts = [
    `${formatCount(usage.input_tokens)} in`,
    `${formatCount(usage.output_tokens)} out`,
  ]
  if (usage.cache_read_tokens)
    parts.push(`${formatCount(usage.cache_read_tokens)} cached`)
  return parts.join(' · ')
}

export const unixIso = (seconds: number) =>
  new Date(seconds * 1000).toISOString()

// One row of a run's step timeline: the recorded step (from the run's frozen spec) and what happened to it, if
// anything yet. A run can report steps its spec doesn't list (an agent run's own steps), so both sides count.
export type TimelineStep = {
  index: number
  label: string
  url: string
  recordedShot: string | null
  result: RunStep | null
}

// Recorded steps read as their action (views.ts stepTitle), like the recording's own page.
export function runTimeline(spec: RunSpec, steps: RunStep[]): TimelineStep[] {
  const recorded = new Map((spec.steps ?? []).map((step) => [step.index, step]))
  const results = new Map(steps.map((step) => [step.step_index, step]))
  const indexes = [...new Set([...recorded.keys(), ...results.keys()])].sort(
    (a, b) => a - b
  )
  return indexes.map((index) => {
    const step = recorded.get(index)
    const result = results.get(index) ?? null
    return {
      index,
      label: step ? stepTitle(step) : result?.label || 'Click',
      url: result?.url || step?.url || '',
      recordedShot: step?.screenshot_artifact_id ?? null,
      result,
    }
  })
}

// The console, exception, and network errors a run reported, by the step they happened in (unattributed ones last).
export type EventGroup = { step: number | null; events: RunEvent[] }

export function errorsByStep(events: RunEvent[]): EventGroup[] {
  const groups = new Map<number | null, RunEvent[]>()
  for (const event of events) {
    if (
      event.level !== 'error' ||
      !['console', 'exception', 'network'].includes(event.kind)
    )
      continue
    const list = groups.get(event.step_index) ?? []
    list.push(event)
    groups.set(event.step_index, list)
  }
  return [...groups]
    .map(([step, list]) => ({ step, events: list }))
    .sort((a, b) => (a.step ?? Infinity) - (b.step ?? Infinity))
}

// A tool call as one line of text: find({"query":"checkout button"}).
export function callText(call: ToolCallEntry, limit = 300) {
  let input: string
  try {
    input = JSON.stringify(call.input ?? {}) ?? ''
  } catch {
    input = '…'
  }
  const text = `${call.name ?? 'tool'}(${input === '{}' ? '' : input})`
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text
}

// What a healed step's new locator says, for the "Accept fix" row.
export function locatorText(locator: Record<string, unknown> | null) {
  if (!locator) return ''
  const parts = ['role', 'name', 'text', 'testid', 'xpath']
    .filter((key) => typeof locator[key] === 'string' && locator[key])
    .map((key) => `${key}: ${String(locator[key])}`)
  return parts.join('\n')
}

// The agents a run can use, in the picker's order: the QA Ninja Agent, the customer's own connections, replay only.
export type BrainChoice = {
  value: string
  title: string
  detail: string
  disabled: boolean
}

export function brainChoices(
  caps: Capabilities,
  connections: AgentConnection[]
): BrainChoice[] {
  const used = caps.execute_managed_used
  const limit = caps.execute_managed_limit
  const managed: BrainChoice = {
    value: 'managed',
    title: 'QA Ninja Agent',
    detail: !caps.execute_managed_available
      ? limit > 0
        ? `Not available right now. ${used} of ${limit} included runs used this month.`
        : 'Not available right now'
      : used >= limit
        ? `All ${limit} included runs used this month`
        : `${used} of ${limit} included runs used this month`,
    disabled: !caps.execute_managed_available || used >= limit,
  }
  const own = connections.map((connection): BrainChoice => ({
    value: connection.id,
    title: connection.label || providerName(connection.provider),
    detail:
      connection.status !== 'active'
        ? `${providerName(connection.provider)} · Reconnect it in Agents`
        : connection.model
          ? `${providerName(connection.provider)} · ${connection.model}`
          : `${providerName(connection.provider)} · Choose a model in Agents`,
    disabled: connection.status !== 'active' || !connection.model,
  }))
  return [
    managed,
    ...own,
    {
      value: 'none',
      title: 'Replay only (no agent)',
      detail: 'Replays the recorded steps without an agent.',
      disabled: false,
    },
  ]
}

// The saved agent while it can still run; otherwise the first agent that can, or replay only.
export function pickBrain(saved: string, choices: BrainChoice[]) {
  const usable = choices.filter((choice) => !choice.disabled)
  if (usable.some((choice) => choice.value === saved)) return saved
  return usable.find((choice) => choice.value !== 'none')?.value ?? 'none'
}

// Assisted and agent runs need an agent, so replay only means replay mode.
export const pickMode = (mode: RunMode, brain: string): RunMode =>
  brain === 'none' ? 'replay' : mode

// The brain to start a run again with: the same agent, if it can still be named.
export function rerunBrain(
  run: Pick<RunSummary, 'brain' | 'connection_id'>
): string | null {
  if (run.brain === 'none' || run.brain === 'managed') return run.brain
  if (run.brain === 'byok' || run.brain === 'oauth') return run.connection_id
  return null
}

// The test settings form. Rows carry a key so React keeps each one's inputs as rows come and go. A recorded input's
// row keeps its name (the recording's steps use it) and starts at the recorded default.
export type InputRow = {
  key: number
  name: string
  value: string
  label?: string
  recorded?: boolean
}
export type SecretRow = SecretName & { key: number }
export type CheckRow = Assertion & { key: number }

export type SettingsForm = {
  goal: string
  expected_outcome: string
  base_url: string
  // One origin per line.
  allowed_origins: string
  inputs: InputRow[]
  secrets: SecretRow[]
  assertions: CheckRow[]
  default_mode: RunMode
  default_brain: string
}

let lastKey = 0
export const rowKey = () => ++lastKey

export const INPUT_NAME = /^[a-z][a-z0-9_]{0,39}$/

export function settingsForm(
  settings: TestSettingsBody,
  recorded: RecordedInput[] = []
): SettingsForm {
  const names = new Set(recorded.map((input) => input.name))
  return {
    goal: settings.goal,
    expected_outcome: settings.expected_outcome,
    base_url: settings.base_url,
    allowed_origins: settings.allowed_origins.join('\n'),
    inputs: [
      ...recorded.map((input) => ({
        key: rowKey(),
        name: input.name,
        label: input.label,
        value: settings.inputs[input.name] ?? input.default,
        recorded: true,
      })),
      ...Object.entries(settings.inputs)
        .filter(([name]) => !names.has(name))
        .map(([name, value]) => ({ key: rowKey(), name, value })),
    ],
    secrets: settings.secrets.map((secret) => ({ ...secret, key: rowKey() })),
    assertions: settings.assertions.map((check) => ({
      ...check,
      key: rowKey(),
    })),
    default_mode: settings.default_mode,
    default_brain: settings.default_brain,
  }
}

export const originLines = (text: string) => [
  ...new Set(
    text
      .split(/[\s,]+/)
      .map((line) => line.trim().replace(/\/+$/, ''))
      .filter(Boolean)
  ),
]

// The PUT body: trimmed, blank rows dropped, origins one per line. The API checks and normalizes it again.
export function settingsBody(form: SettingsForm): TestSettingsBody {
  return {
    goal: form.goal.trim(),
    expected_outcome: form.expected_outcome.trim(),
    base_url: form.base_url.trim().replace(/\/+$/, ''),
    allowed_origins: originLines(form.allowed_origins),
    inputs: Object.fromEntries(
      form.inputs
        .filter((row) => row.recorded || row.name.trim() || row.value)
        .map((row) => [row.name.trim(), row.value])
    ),
    secrets: form.secrets
      .filter((row) => row.name.trim())
      .map((row) => ({ name: row.name.trim(), label: row.label.trim() })),
    assertions: form.assertions
      .filter((row) => row.value.trim())
      .map((row) => ({ type: row.type, value: row.value.trim() })),
    default_mode: form.default_mode,
    default_brain: form.default_brain,
  }
}

// The secrets a test needs, for the line that sends their values to the extension: "Password (password_1)".
export const secretsText = (secrets: SecretName[]) =>
  secrets
    .map(({ name, label }) =>
      label && label !== name ? `${label} (${name})` : name
    )
    .join(', ')

export const sameSettings = (a: TestSettingsBody, b: TestSettingsBody) =>
  JSON.stringify(a) === JSON.stringify(b)

// An exact origin, like https://staging.example.com:8443: http(s), no path, query, credentials, or wildcard.
export function isOrigin(value: string) {
  const text = value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^/?#*]+$/i.test(text)) return false
  try {
    const url = new URL(text)
    return Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

const NAME_RULE =
  'Use lowercase letters, digits, and _, starting with a letter.'

// Field problems, keyed like 'base_url' or 'inputs.7' (a row's key), shown beside the field. Empty when the form can
// be saved.
export function settingsErrors(form: SettingsForm): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.base_url.trim() && !isOrigin(form.base_url))
    errors.base_url =
      'Use an origin like https://staging.example.com, with no path.'
  const origins = originLines(form.allowed_origins)
  const bad = origins.filter((origin) => !isOrigin(origin))
  if (bad.length)
    errors.allowed_origins = `Not an origin: ${bad.join(', ')}. Use origins like https://staging.example.com, with no path.`
  else if (origins.length > 20)
    errors.allowed_origins = 'Allow up to 20 origins.'
  const named = (rows: { key: number; name: string }[], kind: string) => {
    const seen = new Set<string>()
    for (const row of rows) {
      const name = row.name.trim()
      if (!name) continue
      if (!INPUT_NAME.test(name)) errors[`${kind}.${row.key}`] = NAME_RULE
      else if (seen.has(name))
        errors[`${kind}.${row.key}`] = 'This name is already used.'
      seen.add(name)
    }
  }
  named(form.inputs, 'inputs')
  for (const row of form.inputs)
    if (!row.name.trim() && row.value)
      errors[`inputs.${row.key}`] = 'Name this input.'
  if (form.inputs.length > 50) errors.inputs = 'Use up to 50 inputs.'
  named(form.secrets, 'secrets')
  if (form.secrets.length > 20) errors.secrets = 'Use up to 20 secrets.'
  if (form.assertions.length > 20) errors.assertions = 'Use up to 20 checks.'
  return errors
}

// What the extension says. Its answers are checked field by field: anything else counts as no extension.
export type ExtensionInfo = {
  version: string
  signedIn: boolean
  subject: string | null
  execute: boolean
}

export type RunAnswer =
  | { ok: true }
  | {
      ok: false
      error:
        'not_signed_in' | 'account_mismatch' | 'busy' | 'not_found' | 'failed'
      message: string
    }

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null

export function readPing(value: unknown): ExtensionInfo | null {
  const answer = record(value)
  if (!answer || answer.ok !== true) return null
  return {
    version: typeof answer.version === 'string' ? answer.version : '',
    signedIn: answer.signedIn === true,
    subject: typeof answer.subject === 'string' ? answer.subject : null,
    execute: answer.execute === true,
  }
}

const REFUSALS = [
  'not_signed_in',
  'account_mismatch',
  'busy',
  'not_found',
  'failed',
] as const

export function readRunAnswer(value: unknown): RunAnswer | null {
  const answer = record(value)
  if (!answer) return null
  if (answer.ok === true) return { ok: true }
  if (answer.ok !== false) return null
  const error = REFUSALS.find((code) => code === answer.error) ?? 'failed'
  const message =
    typeof answer.message === 'string' ? answer.message.slice(0, 300) : ''
  return { ok: false, error, message }
}

const NOT_SIGNED_IN =
  'Log in to the QA Ninja extension with this account, then try again.'
const MISMATCH =
  'The QA Ninja extension is signed in to a different account. Log in there with this account, then try again.'

// Why this browser can't run a test now, or null when it can.
export function extensionProblem(
  info: ExtensionInfo | null,
  subject: string | null
): string | null {
  if (!info)
    return 'Install the QA Ninja extension in this Chrome to run tests on this computer. Already installed? Update it, then reload this page.'
  if (!info.execute)
    return 'Update the QA Ninja extension to run tests from the dashboard, then reload this page.'
  if (!info.signedIn) return NOT_SIGNED_IN
  if (info.subject && subject && info.subject !== subject) return MISMATCH
  return null
}

// Why the extension didn't start a run, or null when it did.
export function runRefusal(answer: RunAnswer | null): string | null {
  if (!answer)
    return "The QA Ninja extension didn't answer. Reload this page and try again."
  if (answer.ok) return null
  switch (answer.error) {
    case 'not_signed_in':
      return NOT_SIGNED_IN
    case 'account_mismatch':
      return MISMATCH
    case 'busy':
      return 'The extension is already running a test. Stop it or let it finish, then try again.'
    case 'not_found':
      return "The extension couldn't find this run. Try again."
    default:
      return (
        answer.message || "The extension couldn't start this run. Try again."
      )
  }
}

// Coding agents (MCP): the local bridge drives this browser; the remote server only manages tests and runs.
export type McpSnippet = {
  id: string
  title: string
  where: string
  text: string
}

const MCP_JSON = JSON.stringify({
  mcpServers: { qaninja: { command: 'npx', args: ['-y', '@qaninja/mcp'] } },
})

export function mcpSnippets(apiBaseUrl: string, remote: boolean): McpSnippet[] {
  const snippets: McpSnippet[] = [
    {
      id: 'claude-code',
      title: 'Claude Code',
      where: 'Run in a terminal',
      text: 'claude mcp add qaninja -- npx -y @qaninja/mcp',
    },
    {
      id: 'codex',
      title: 'Codex',
      where: 'Run in a terminal',
      text: 'codex mcp add qaninja -- npx -y @qaninja/mcp',
    },
    {
      id: 'cursor',
      title: 'Cursor',
      where: 'Add to .cursor/mcp.json',
      text: MCP_JSON,
    },
    {
      id: 'claude-desktop',
      title: 'Claude Desktop',
      where: 'Add to claude_desktop_config.json',
      text: MCP_JSON,
    },
  ]
  if (remote)
    snippets.push({
      id: 'remote',
      title: 'Remote control (Claude Code)',
      where:
        'Manage tests and runs from anywhere; runs still happen in this Chrome',
      text: `claude mcp add --transport http qaninja ${apiBaseUrl}/mcp`,
    })
  return snippets
}
