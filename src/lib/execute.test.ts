import { describe, expect, it } from 'vitest'
import {
  agentText,
  blockedText,
  brainChoices,
  callText,
  errorsByStep,
  extensionProblem,
  formatCost,
  formatDuration,
  isOrigin,
  locatorText,
  mcpSnippets,
  originLines,
  pickBrain,
  pickMode,
  progressText,
  readPing,
  readRunAnswer,
  rerunBrain,
  runRefusal,
  secretsText,
  runTimeline,
  sameSettings,
  settingsBody,
  settingsErrors,
  settingsForm,
  stepsText,
  tokensText,
} from './execute'
import type {
  AgentConnection,
  Capabilities,
  RunEvent,
  RunStep,
  RunSummary,
  TestSettingsBody,
} from './types'

const caps = (changes: Partial<Capabilities> = {}): Capabilities => ({
  user_id: 1,
  email: 'one@example.com',
  plan: 'BASIC',
  recording: true,
  cloud_save: true,
  cloud_limit: 25,
  cloud_used: 1,
  valid_until: 0,
  access_source: 'stripe',
  execute: true,
  execute_managed_available: true,
  execute_managed_limit: 10,
  execute_managed_used: 3,
  execute_managed_resets_at: 1793491200,
  execute_remote_mcp: false,
  ...changes,
})

const connection = (
  changes: Partial<AgentConnection> = {}
): AgentConnection => ({
  id: 'conn_c0ffee00000000000000000000000000',
  provider: 'anthropic',
  kind: 'api_key',
  label: 'Team key',
  model: 'claude-sonnet-5-5',
  last4: 'abcd',
  status: 'active',
  created_at: 0,
  last_used_at: null,
  ...changes,
})

const run = (changes: Partial<RunSummary> = {}): RunSummary => ({
  id: 'run_5eed0000000000000000000000000001',
  workflow_id: 1,
  name: 'Checkout',
  origin: 'dashboard',
  runner: 'local',
  mode: 'assisted',
  brain: 'byok',
  connection_id: 'conn_c0ffee00000000000000000000000000',
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  status: 'completed',
  phase: '',
  verdict: 'FAILED',
  blocked_reason: null,
  summary: '',
  error: '',
  requires_approval: false,
  cancel_requested: false,
  steps_total: 2,
  steps_passed: 1,
  healed_steps: 1,
  failing_step: 1,
  current_step: 1,
  model_calls: 1,
  cost_usd: 0.0184,
  created_at: null,
  started_at: null,
  finished_at: null,
  duration_ms: 72000,
  ...changes,
})

const step = (index: number, changes: Partial<RunStep> = {}): RunStep => ({
  step_index: index,
  recorded_step_id: `step-${index}`,
  label: `Step ${index}`,
  action_type: 'click',
  status: 'passed',
  resolution: 'replay',
  locator_used: 'xpath',
  locator: null,
  url: 'https://example.com',
  error_code: null,
  error_message: null,
  screenshot_artifact_id: null,
  duration_ms: 100,
  finished_at: 0,
  ...changes,
})

const event = (seq: number, changes: Partial<RunEvent> = {}): RunEvent => ({
  client_seq: seq,
  step_index: null,
  kind: 'console',
  level: 'error',
  message: `event ${seq}`,
  data: {},
  at: 0,
  ...changes,
})

const saved: TestSettingsBody = {
  goal: 'Buy a hat',
  expected_outcome: 'An order number is shown',
  base_url: '',
  allowed_origins: ['https://shop.example.com'],
  inputs: { email: 'qa@example.com' },
  secrets: [{ name: 'password', label: 'Password' }],
  assertions: [{ type: 'url_contains', value: '/orders/' }],
  default_mode: 'assisted',
  default_brain: 'managed',
}

describe('run words', () => {
  it('formats durations, costs, tokens, and steps', () => {
    expect(formatDuration(null)).toBe('')
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(420)).toBe('0.4s')
    expect(formatDuration(4200)).toBe('4.2s')
    expect(formatDuration(12_400)).toBe('12s')
    expect(formatDuration(72_000)).toBe('1m 12s')
    expect(formatDuration(3_725_000)).toBe('1h 2m')
    expect(formatCost(0)).toBe('$0.00')
    expect(formatCost(0.0184)).toBe('$0.0184')
    expect(formatCost(0.4)).toBe('$0.40')
    expect(formatCost(0.001)).toBe('$0.001')
    expect(formatCost(12.345)).toBe('$12.35')
    expect(
      tokensText({
        input_tokens: 3120,
        output_tokens: 240,
        cache_read_tokens: 2048,
        cache_write_tokens: 0,
        model_calls: 1,
        cost_usd: 0,
      })
    ).toBe('3,120 in · 240 out · 2,048 cached')
    expect(stepsText(run())).toBe('1 of 2 steps passed, 1 healed')
    expect(stepsText(run({ steps_total: 1, healed_steps: 0 }))).toBe(
      '1 of 1 step passed'
    )
  })

  it('names the agent and model behind a run', () => {
    expect(agentText(run())).toBe('Anthropic (your key) · claude-sonnet-5-5')
    expect(agentText(run({ brain: 'none', provider: '', model: '' }))).toBe(
      'Replay only'
    )
    expect(agentText(run({ brain: 'managed', model: 'claude-opus-5-5' }))).toBe(
      'QA Ninja Agent · claude-opus-5-5'
    )
    expect(
      agentText(run({ brain: 'oauth', provider: 'openrouter', model: '' }))
    ).toBe('OpenRouter')
  })

  it('says what a run is doing and why it stopped', () => {
    expect(progressText(run({ status: 'queued' }))).toBe(
      'Waiting for the extension to start it'
    )
    expect(
      progressText(
        run({ status: 'running', phase: 'replaying', current_step: 0 })
      )
    ).toBe('Replaying: step 1 of 2')
    expect(
      progressText(run({ status: 'running', cancel_requested: true }))
    ).toBe('Stopping')
    expect(
      progressText(run({ status: 'error', error: 'runner_disconnected' }))
    ).toBe('The browser running it stopped responding.')
    expect(progressText(run({ status: 'error', error: 'odd' }))).toBe('odd')
    expect(progressText(run())).toBe('')
    expect(blockedText('captcha')).toBe('A CAPTCHA appeared.')
    expect(blockedText('something_new')).toBe('something_new')
    expect(blockedText(null)).toBe('')
  })
})

describe('runTimeline', () => {
  it('pairs recorded steps with what happened to them', () => {
    const timeline = runTimeline(
      {
        steps: [
          {
            index: 0,
            id: 'step-0',
            action_type: 'click',
            label: 'Click checkout',
            url: 'https://example.com',
            value: null,
            value_ref: null,
            screenshot_artifact_id: 'shot-0',
          },
          {
            index: 1,
            id: 'step-1',
            action_type: 'click',
            label: 'Place order',
            url: 'https://example.com/cart',
            value: null,
            value_ref: null,
            screenshot_artifact_id: null,
          },
          {
            index: 2,
            id: 'step-2',
            action_type: 'fill',
            label: 'Password',
            url: 'https://example.com/login',
            value: null,
            value_ref: { kind: 'secret', name: 'password_1' },
            screenshot_artifact_id: null,
          },
        ],
      },
      [step(0, { label: '', status: 'healed' }), step(3, { label: 'Extra' })]
    )
    expect(
      timeline.map(({ index, label, recordedShot, result }) => [
        index,
        label,
        recordedShot,
        result?.status ?? null,
      ])
    ).toEqual([
      [0, 'Click checkout', 'shot-0', 'healed'],
      [1, 'Place order', null, null],
      [2, 'Typed a secret (password_1) into Password', null, null],
      [3, 'Extra', null, 'passed'],
    ])
    expect(runTimeline({}, [])).toEqual([])
  })
})

describe('errorsByStep', () => {
  it('keeps console, exception, and network errors, by step', () => {
    const groups = errorsByStep([
      event(1, { step_index: 2 }),
      event(2, { level: 'warning', step_index: 2 }),
      event(3, { kind: 'navigation', step_index: 0 }),
      event(4, { kind: 'network', step_index: 0 }),
      event(5),
      event(6, { kind: 'exception', step_index: 2 }),
    ])
    expect(
      groups.map((group) => [
        group.step,
        group.events.map((item) => item.client_seq),
      ])
    ).toEqual([
      [0, [4]],
      [2, [1, 6]],
      [null, [5]],
    ])
  })
})

describe('transcript text', () => {
  it('writes tool calls and locators compactly', () => {
    expect(
      callText({ id: 'a', name: 'find', input: { query: 'checkout button' } })
    ).toBe('find({"query":"checkout button"})')
    expect(callText({ id: 'b', name: 'screenshot', input: {} })).toBe(
      'screenshot()'
    )
    expect(callText({ id: null, name: null, input: null })).toBe('tool()')
    expect(
      callText({ id: 'c', name: 'type', input: { text: 'x'.repeat(400) } })
    ).toHaveLength(300)
    expect(
      locatorText({ xpath: '//button', role: 'button', name: 'Checkout', n: 1 })
    ).toBe('role: button\nname: Checkout\nxpath: //button')
    expect(locatorText(null)).toBe('')
  })
})

describe('agent choices', () => {
  it('lists the QA Ninja Agent, own connections, and replay only', () => {
    const choices = brainChoices(caps(), [
      connection(),
      connection({
        id: 'conn_2',
        label: '',
        provider: 'openrouter',
        model: '',
      }),
      connection({ id: 'conn_3', status: 'invalid' }),
    ])
    expect(
      choices.map(({ value, title, detail, disabled }) => [
        value,
        title,
        detail,
        disabled,
      ])
    ).toEqual([
      [
        'managed',
        'QA Ninja Agent',
        '3 of 10 included runs used this month',
        false,
      ],
      [
        'conn_c0ffee00000000000000000000000000',
        'Team key',
        'Anthropic · claude-sonnet-5-5',
        false,
      ],
      ['conn_2', 'OpenRouter', 'OpenRouter · Choose a model in Agents', true],
      ['conn_3', 'Team key', 'Anthropic · Reconnect it in Agents', true],
      [
        'none',
        'Replay only (no agent)',
        'Replays the recorded steps without an agent.',
        false,
      ],
    ])
    expect(
      brainChoices(caps({ execute_managed_used: 10 }), [])[0]
    ).toMatchObject({
      detail: 'All 10 included runs used this month',
      disabled: true,
    })
    expect(
      brainChoices(caps({ execute_managed_available: false }), [])[0]
    ).toMatchObject({
      detail: 'Not available right now. 3 of 10 included runs used this month.',
      disabled: true,
    })
    expect(
      brainChoices(
        caps({ execute_managed_available: false, execute_managed_limit: 0 }),
        []
      )[0].detail
    ).toBe('Not available right now')
  })

  it('keeps the saved agent while it can run, and needs one for assisted runs', () => {
    const choices = brainChoices(caps({ execute_managed_available: false }), [
      connection(),
    ])
    expect(pickBrain('conn_c0ffee00000000000000000000000000', choices)).toBe(
      'conn_c0ffee00000000000000000000000000'
    )
    expect(pickBrain('none', choices)).toBe('none')
    expect(pickBrain('managed', choices)).toBe(
      'conn_c0ffee00000000000000000000000000'
    )
    expect(pickBrain('conn_gone', brainChoices(caps(), []))).toBe('managed')
    expect(
      pickBrain(
        'managed',
        brainChoices(caps({ execute_managed_available: false }), [])
      )
    ).toBe('none')
    expect(pickMode('agent', 'none')).toBe('replay')
    expect(pickMode('agent', 'managed')).toBe('agent')
  })

  it('re-runs with the same agent when it can be named', () => {
    expect(rerunBrain(run())).toBe('conn_c0ffee00000000000000000000000000')
    expect(rerunBrain(run({ brain: 'managed' }))).toBe('managed')
    expect(rerunBrain(run({ brain: 'none' }))).toBe('none')
    expect(rerunBrain(run({ brain: 'oauth', connection_id: null }))).toBe(null)
    expect(rerunBrain(run({ brain: 'mcp' }))).toBe(null)
  })
})

describe('test settings form', () => {
  it("starts the recording's own inputs at their recorded values, and keeps their names", () => {
    const recorded = [
      { name: 'email_1', label: 'Email', default: 'qa@example.com' },
      { name: 'size_1', label: 'Size', default: 'M' },
    ]
    const form = settingsForm(
      { ...saved, inputs: { size_1: 'L', coupon: 'SAVE10' } },
      recorded
    )
    expect(
      form.inputs.map(({ name, label, value, recorded }) => ({
        name,
        label,
        value,
        recorded,
      }))
    ).toEqual([
      {
        name: 'email_1',
        label: 'Email',
        value: 'qa@example.com',
        recorded: true,
      },
      { name: 'size_1', label: 'Size', value: 'L', recorded: true },
      {
        name: 'coupon',
        label: undefined,
        value: 'SAVE10',
        recorded: undefined,
      },
    ])
    // A recorded input stays in the body even when emptied, so the run types what's on screen.
    form.inputs[0].value = ''
    expect(settingsBody(form).inputs).toEqual({
      email_1: '',
      size_1: 'L',
      coupon: 'SAVE10',
    })
    expect(
      sameSettings(
        settingsBody(settingsForm(saved, recorded)),
        settingsBody(settingsForm(saved, recorded))
      )
    ).toBe(true)
  })

  it('names the secrets a test needs', () => {
    expect(
      secretsText([
        { name: 'password_1', label: 'Password' },
        { name: 'otp', label: 'otp' },
        { name: 'token', label: '' },
      ])
    ).toBe('Password (password_1), otp, token')
  })

  it('round-trips the saved settings', () => {
    const form = settingsForm(saved)
    expect(form.allowed_origins).toBe('https://shop.example.com')
    expect(form.inputs).toEqual([
      { key: expect.any(Number), name: 'email', value: 'qa@example.com' },
    ])
    expect(settingsBody(form)).toEqual(saved)
    expect(sameSettings(settingsBody(form), saved)).toBe(true)
  })

  it('trims, drops blank rows, and splits origins', () => {
    const form = settingsForm(saved)
    form.goal = '  Buy two hats \n'
    form.base_url = ' https://staging.example.com/ '
    form.allowed_origins =
      'https://shop.example.com/\n\n https://login.example.com, https://shop.example.com'
    form.inputs.push({ key: 1001, name: ' size ', value: ' L ' })
    form.inputs.push({ key: 1002, name: '', value: '' })
    form.secrets.push({ key: 1003, name: '', label: 'Unused' })
    form.assertions.push({ key: 1004, type: 'title_contains', value: '  ' })
    const body = settingsBody(form)
    expect(body).toEqual({
      ...saved,
      goal: 'Buy two hats',
      base_url: 'https://staging.example.com',
      allowed_origins: [
        'https://shop.example.com',
        'https://login.example.com',
      ],
      inputs: { email: 'qa@example.com', size: ' L ' },
    })
    expect(sameSettings(body, saved)).toBe(false)
    expect(originLines(' a\nb,c  a ')).toEqual(['a', 'b', 'c'])
  })

  it('finds what the API would refuse', () => {
    expect(settingsErrors(settingsForm(saved))).toEqual({})
    const form = settingsForm(saved)
    form.base_url = 'https://staging.example.com/app'
    form.allowed_origins =
      'https://ok.example.com\nshop.example.com\nhttps://*.example.com'
    form.inputs = [
      { key: 1, name: 'Email', value: 'x' },
      { key: 2, name: 'size', value: 'L' },
      { key: 3, name: 'size', value: 'M' },
      { key: 4, name: '', value: 'orphan' },
    ]
    form.secrets = [{ key: 5, name: '1password', label: '' }]
    expect(settingsErrors(form)).toEqual({
      base_url: 'Use an origin like https://staging.example.com, with no path.',
      allowed_origins:
        'Not an origin: shop.example.com, https://*.example.com. Use origins like https://staging.example.com, with no path.',
      'inputs.1':
        'Use lowercase letters, digits, and _, starting with a letter.',
      'inputs.3': 'This name is already used.',
      'inputs.4': 'Name this input.',
      'secrets.5':
        'Use lowercase letters, digits, and _, starting with a letter.',
    })
  })

  it('accepts exact origins only', () => {
    for (const origin of [
      'https://staging.example.com',
      'http://localhost:3000',
      'https://staging.example.com/',
      'HTTPS://Example.com:8443',
    ])
      expect(isOrigin(origin), origin).toBe(true)
    for (const origin of [
      '',
      'staging.example.com',
      'https://',
      'https://example.com/path',
      'https://example.com?x=1',
      'https://example.com#top',
      'https://user:pass@example.com',
      'https://*.example.com',
      'ftp://example.com',
      'javascript:alert(1)',
    ])
      expect(isOrigin(origin), origin).toBe(false)
  })
})

describe('extension answers', () => {
  const ready = {
    ok: true,
    version: '2.1.0',
    signedIn: true,
    subject: 'user_1',
    execute: true,
  }

  it('reads a ping field by field', () => {
    expect(readPing(ready)).toEqual({
      version: '2.1.0',
      signedIn: true,
      subject: 'user_1',
      execute: true,
    })
    expect(readPing({ ok: true })).toEqual({
      version: '',
      signedIn: false,
      subject: null,
      execute: false,
    })
    for (const answer of [undefined, null, 'ok', { ok: 'true' }, { ok: false }])
      expect(readPing(answer)).toBe(null)
  })

  it('explains why this browser cannot run a test', () => {
    expect(extensionProblem(readPing(ready), 'user_1')).toBe(null)
    expect(extensionProblem(null, 'user_1')).toMatch(
      /^Install the QA Ninja extension/
    )
    expect(
      extensionProblem(readPing({ ...ready, execute: false }), 'user_1')
    ).toMatch(/^Update the QA Ninja extension/)
    expect(
      extensionProblem(readPing({ ...ready, signedIn: false }), 'user_1')
    ).toMatch(/^Log in to the QA Ninja extension/)
    expect(extensionProblem(readPing(ready), 'user_2')).toMatch(
      /signed in to a different account/
    )
  })

  it('reads the answer to a run request', () => {
    expect(readRunAnswer({ ok: true })).toEqual({ ok: true })
    expect(
      readRunAnswer({ ok: false, error: 'busy', message: 'Busy.' })
    ).toEqual({ ok: false, error: 'busy', message: 'Busy.' })
    expect(readRunAnswer({ ok: false, error: 'weird' })).toEqual({
      ok: false,
      error: 'failed',
      message: '',
    })
    expect(readRunAnswer('yes')).toBe(null)
    expect(runRefusal({ ok: true })).toBe(null)
    expect(runRefusal(null)).toMatch(/didn't answer/)
    expect(runRefusal({ ok: false, error: 'busy', message: '' })).toMatch(
      /^The extension is already running a test/
    )
    expect(
      runRefusal({ ok: false, error: 'failed', message: 'No window.' })
    ).toBe('No window.')
    expect(runRefusal({ ok: false, error: 'failed', message: '' })).toBe(
      "The extension couldn't start this run. Try again."
    )
  })
})

describe('mcpSnippets', () => {
  it('offers the local bridge, and the remote server when it is on', () => {
    const local = mcpSnippets('https://api.qaninja.studio', false)
    expect(local.map((snippet) => snippet.id)).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'claude-desktop',
    ])
    expect(local[0].text).toBe('claude mcp add qaninja -- npx -y @qaninja/mcp')
    expect(local[1].text).toBe('codex mcp add qaninja -- npx -y @qaninja/mcp')
    expect(local[2].text).toBe(
      '{"mcpServers":{"qaninja":{"command":"npx","args":["-y","@qaninja/mcp"]}}}'
    )
    expect(local[3].text).toBe(local[2].text)
    expect(JSON.parse(local[2].text)).toEqual({
      mcpServers: {
        qaninja: { command: 'npx', args: ['-y', '@qaninja/mcp'] },
      },
    })
    expect(mcpSnippets('https://api.qaninja.studio', true).at(-1)?.text).toBe(
      'claude mcp add --transport http qaninja https://api.qaninja.studio/mcp'
    )
  })
})
