// Response shapes of the QA Ninja API (api/src/core/product_routes.py and api/src/execute/), field for field.

export type PlanCode = 'FREE' | 'BASIC' | 'SUPER'

// GET /me/capabilities and GET /me/account
export type Capabilities = {
  user_id: number
  email: string
  plan: PlanCode
  recording: boolean
  cloud_save: boolean
  // BASIC 25, SUPER null (unlimited), FREE 0
  cloud_limit: number | null
  cloud_used: number
  valid_until: number
  access_source: 'stripe' | 'support_grant' | 'free'
  // Execute comes with any paid plan once the service turns it on. QA Ninja Agent runs are metered per calendar month
  // (UTC); the limit is 0 without Execute. resets_at is in unix seconds.
  execute: boolean
  execute_managed_available: boolean
  execute_managed_limit: number
  execute_managed_used: number
  execute_managed_resets_at: number
  execute_remote_mcp: boolean
}

// GET /workflows, newest first. Saved recordings outlive a subscription for download and delete.
export type PlanSummary = {
  id: number
  name: string
  created_at: string
  steps: number
}

export type Artifact = {
  id: string
  filename: string
  media_type: string
}

export type StepAction =
  'click' | 'fill' | 'select' | 'check' | 'uncheck' | 'press' | 'navigate'

// A value a run supplies: a secret (never captured; the extension asks for it) or an input.
export type ValueRef = { kind: 'secret' | 'input'; name: string }

// One recorded step as the extension saves it (extension/exports.mjs). Recordings migrated from before the extension's
// schema keep their screenshot under screenshot_path; those files aren't previewable. Schema 2
// (api/src/core/recording_schema.py) adds the action and what it typed, chose, or pressed: a sensitive step has no
// value, only a secret value_ref, and a navigate step has no XPath.
export type RecordingStep = {
  url: string
  xpath: string
  label?: string
  screenshot?: string | null
  screenshot_path?: string | null
  timestamp?: string
  frameId?: number | string | null
  id?: string
  action_type?: StepAction
  value?: string | null
  sensitive?: boolean
  value_ref?: ValueRef | null
  key?: string | null
  locators?: {
    xpath?: string
    full_xpath?: string
    role?: string
    name?: string
    text?: string
    testid?: string
    tag?: string
    attributes?: Record<string, string>
  } | null
  frame?: { url?: string } | null
}

export type RecordingManifest = {
  schema_version?: number
  id?: string
  name?: string
  created_at?: string
  start_url?: string
  viewport?: { width: number; height: number }
  inputs?: { name: string; label?: string; default?: string }[]
  secrets?: { name: string; label?: string; kind?: string }[]
  steps?: RecordingStep[]
}

// GET /workflows/{id}. Needs an active plan (403 otherwise).
export type WorkflowDetail = {
  id: number
  name: string
  created_at: string
  recording: RecordingManifest
  artifacts: Artifact[]
}

export type PaidPlan = Exclude<PlanCode, 'FREE'>
export type BillingInterval = 'monthly' | 'yearly'

// POST /billing/checkout body
export type CheckoutBody = { plan: PaidPlan; interval: BillingInterval }

// POST /billing/checkout and POST /billing/portal
export type UrlResponse = { url: string }

// Execute (api/src/execute): run recorded tests with an agent in the customer's own Chrome. Times named *_at are ISO
// strings on runs and tests, and unix seconds on connections, settings, events, artifacts, and episodes.

export type RunMode = 'replay' | 'assisted' | 'agent'
export type AssertionType = 'url_contains' | 'text_visible' | 'title_contains'
export type RunStatus =
  'queued' | 'running' | 'completed' | 'error' | 'cancelled'
export type Verdict = 'PASSED' | 'FAILED' | 'BLOCKED'
export type StepStatus = 'passed' | 'healed' | 'failed' | 'skipped' | 'blocked'
// The agent behind a run: none (replay only), the QA Ninja Agent, the customer's key or OAuth login, or a coding agent.
export type BrainKind = 'none' | 'managed' | 'byok' | 'oauth' | 'mcp'
export type Provider =
  'anthropic' | 'openai' | 'google' | 'openrouter' | 'chatgpt'
export type KeyProvider = 'anthropic' | 'openai' | 'google'

export type SecretName = { name: string; label: string }
// An input a schema 2 recording asks for, with the value it was recorded with (if it wasn't sensitive).
export type RecordedInput = { name: string; label: string; default: string }
export type Assertion = { type: AssertionType; value: string }

// PUT /execute/tests/{id}/settings body. default_brain is 'none', 'managed' or a connection ID (conn_…).
export type TestSettingsBody = {
  goal: string
  expected_outcome: string
  base_url: string
  allowed_origins: string[]
  inputs: Record<string, string>
  secrets: SecretName[]
  assertions: Assertion[]
  default_mode: RunMode
  default_brain: string
}

// A test's settings as the API returns them, and the PUT's response.
export type TestSettings = TestSettingsBody & {
  has_trace: boolean
  healed_steps: number
  updated_at: number | null
}

export type LastRun = {
  id: string
  status: RunStatus
  verdict: Verdict | null
  created_at: string | null
  finished_at: string | null
}

// GET /execute/tests: the customer's recordings as tests, newest first.
export type ExecuteTest = {
  id: number
  name: string
  created_at: string
  steps: number
  schema_version: number
  start_url: string
  origins: string[]
  // Secrets a run needs (the recording's and the settings'), by name only, and the recording's own inputs.
  secrets: SecretName[]
  inputs: RecordedInput[]
  settings: TestSettings
  last_run: LastRun | null
}

export type TestStep = {
  index: number
  action_type: string
  label: string
  url: string
  description: string
  healed: boolean
}

// GET /execute/tests/{id}
export type TestDetail = {
  id: number
  name: string
  created_at: string
  schema_version: number
  start_url: string
  steps: TestStep[]
  secrets: SecretName[]
  inputs: RecordedInput[]
  settings: TestSettings
  recent_runs: RunSummary[]
}

export type RunSummary = {
  id: string
  workflow_id: number | null
  name: string
  origin: 'extension' | 'dashboard' | 'mcp_local' | 'mcp_remote'
  runner: 'local' | 'cloud'
  mode: RunMode
  brain: BrainKind
  connection_id: string | null
  provider: string
  model: string
  status: RunStatus
  phase: string
  verdict: Verdict | null
  blocked_reason: string | null
  summary: string
  error: string
  requires_approval: boolean
  cancel_requested: boolean
  steps_total: number
  steps_passed: number
  healed_steps: number
  failing_step: number | null
  current_step: number | null
  model_calls: number
  cost_usd: number
  created_at: string | null
  started_at: string | null
  finished_at: string | null
  duration_ms: number | null
}

// One step of a run's frozen spec: the recorded step it replays.
export type SpecStep = {
  index: number
  id: string
  action_type: string
  label: string
  url: string
  value: string | null
  value_ref: { kind?: string; name?: string } | null
  key?: string | null
  screenshot_artifact_id: string | null
}

export type RunSpec = {
  steps?: SpecStep[]
  start_url?: string
  allowed_origins?: string[]
  goal?: string
  expected_outcome?: string
}

export type RunStep = {
  step_index: number
  recorded_step_id: string | null
  label: string
  action_type: string
  status: StepStatus
  resolution: 'replay' | 'agent' | 'user' | 'mcp' | 'none'
  locator_used: string
  locator: Record<string, unknown> | null
  url: string
  error_code: string | null
  error_message: string | null
  screenshot_artifact_id: string | null
  duration_ms: number
  finished_at: number
}

export type RunEvent = {
  client_seq: number
  step_index: number | null
  kind: string
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
  data: Record<string, unknown>
  at: number
}

export type RunArtifact = {
  id: string
  kind: string
  filename: string
  media_type: string
  size: number
  step_index: number | null
  created_at: number
}

export type RunUsage = {
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  model_calls: number
  cost_usd: number
}

// GET /execute/runs/{id}
export type RunDetail = RunSummary & {
  spec: RunSpec
  steps: RunStep[]
  events: RunEvent[]
  artifacts: RunArtifact[]
  episodes: unknown[]
  usage: RunUsage
}

// GET /execute/runs: newest first; pass next_cursor as ?before= for the next page.
export type RunsPage = { data: RunSummary[]; next_cursor: string | null }

// POST /execute/runs body, as the dashboard sends it: the run waits (queued) for the extension to claim it.
export type StartRunBody = {
  workflow_id: number
  origin: 'dashboard'
  mode: RunMode
  brain: string
  base_url?: string
  inputs?: Record<string, string>
}

export type StartRunResponse = { run: RunSummary; spec: null }

export type ToolCallEntry = {
  id: string | null
  name: string | null
  input: unknown
}

// GET /execute/runs/{id}/transcript: each agent episode, readable. Images are this run's screenshot artifact IDs.
export type TranscriptEntry =
  | { type: 'brief' | 'note' | 'nudge'; text: string }
  | {
      type: 'assistant'
      notes: string
      calls: ToolCallEntry[]
      model: string | null
      fallback: boolean
      cost_usd: number
    }
  | {
      type: 'result'
      tool_use_id: string | null
      error: boolean
      text: string
      images: string[]
    }

export type TranscriptEpisode = {
  id: string
  seq: number
  kind: 'recover' | 'data' | 'verify' | 'agent'
  step_index: number | null
  status: 'open' | 'step_done' | 'verdict' | 'exhausted' | 'error'
  provider: string
  model: string
  summary: string
  cost_usd: number
  entries: TranscriptEntry[]
}

// GET /execute/connections: the customer's own agents. Keys are never returned; last4 identifies one.
export type AgentConnection = {
  id: string
  provider: Provider
  kind: 'api_key' | 'oauth'
  label: string
  model: string
  last4: string
  status: 'active' | 'invalid'
  created_at: number
  last_used_at: number | null
}

// POST /execute/connections and POST /execute/connections/openrouter/complete: the connection and its models.
export type NewConnection = AgentConnection & { models: string[] }

export type AddKeyBody = {
  provider: KeyProvider
  api_key: string
  label?: string
  model?: string
}

export type OAuthStart = { url: string; state: string }
