import { describe, expect, it } from 'vitest'
import type { Artifact } from './types'
import {
  BAD_LINK,
  EXECUTE_UNAVAILABLE,
  NOT_FOUND,
  PLAN_REQUIRED,
  RECORDING_MISSING,
  RUN_MISSING,
  errorPage,
  groupFiles,
  isRunId,
  isWorkflowId,
  planName,
  safeNext,
  screenshotIds,
  stepTitle,
  utcIso,
} from './views'

const RUN = 'run_5eed0000000000000000000000000001'

const artifact = (filename: string, media_type = 'text/plain'): Artifact => ({
  id: `id-${filename}`,
  filename,
  media_type,
})

describe('safeNext', () => {
  it('keeps the pages sign-in may return to', () => {
    for (const next of [
      '/dashboard',
      '/account',
      '/account?checkout=success',
      '/workflow/1',
      '/workflow/123456789012345678',
      '/execute',
      '/execute?tab=run',
      '/execute?tab=runs',
      '/execute?tab=agents',
      `/execute/runs/${RUN}`,
    ])
      expect(safeNext(next)).toBe(next)
  })

  it('sends everything else to the recordings', () => {
    for (const next of [
      'https://evil.example/',
      '//evil.example',
      '/workflow/0',
      '/workflow/12/../../evil',
      '/account#evil',
      '/workflows/1/download',
      '/workflow/1234567890123456789',
      '/dashboard?deleted=1',
      '',
      '/execute/',
      '/execute?tab=billing',
      '/execute?tab=runs&next=https://evil.example',
      '/execute?tab=run&test=1',
      '/execute#runs',
      '/execute/runs/run_5EED0000000000000000000000000001',
      '/execute/runs/run_5eed000000000000000000000000001',
      `/execute/runs/${RUN}0`,
      `/execute/runs/${RUN}/`,
      `/execute/runs/${RUN}?x=1`,
      '/execute/runs/%2e%2e',
      '/execute/connect/openrouter',
      '/execute/connect/openrouter?code=abc',
    ])
      expect(safeNext(next)).toBe('/dashboard')
  })
})

describe('isRunId', () => {
  it('accepts the API run IDs only', () => {
    expect(isRunId(RUN)).toBe(true)
    expect(isRunId('run_5eed')).toBe(false)
    expect(isRunId(RUN.toUpperCase())).toBe(false)
    expect(isRunId(`${RUN} `)).toBe(false)
  })
})

describe('isWorkflowId', () => {
  it('accepts positive integers the API can store', () => {
    expect(isWorkflowId('1')).toBe(true)
    expect(isWorkflowId('0')).toBe(false)
    expect(isWorkflowId('abc')).toBe(false)
    expect(isWorkflowId('01')).toBe(false)
  })
})

describe('utcIso', () => {
  it('marks SQLite timestamps as UTC', () => {
    expect(utcIso('2026-09-28 16:12:03')).toBe('2026-09-28T16:12:03Z')
  })

  it('leaves other values alone', () => {
    expect(utcIso('2026-09-28T16:12:03Z')).toBe('2026-09-28T16:12:03Z')
    expect(utcIso('2020-01-01')).toBe('2020-01-01')
    expect(utcIso(undefined)).toBe('')
  })
})

describe('planName', () => {
  it('names each plan', () => {
    expect(planName('FREE')).toBe('XPath Finder (free)')
    expect(planName('BASIC')).toBe('Basic')
    expect(planName('SUPER')).toBe('Supercharged')
    expect(planName('LEGACY')).toBe('LEGACY')
  })
})

describe('groupFiles', () => {
  it('groups known files in order and leaves step screenshots out', () => {
    const artifacts = [
      artifact('zz-notes.txt'),
      artifact('recording.json', 'application/json'),
      artifact('screenshots/step-00001.jpg', 'image/jpeg'),
      artifact('script_robot.robot'),
      artifact('report.pdf', 'application/pdf'),
      artifact('script_playwright.py'),
    ]
    const steps = [
      {
        url: 'https://example.com',
        xpath: '//a',
        screenshot: 'screenshots/step-00001.jpg',
      },
    ]
    expect(groupFiles(artifacts, steps)).toEqual([
      {
        title: 'Scripts',
        files: [
          {
            id: 'id-script_playwright.py',
            label: 'Playwright (Python)',
            filename: 'script_playwright.py',
          },
          {
            id: 'id-script_robot.robot',
            label: 'Robot Framework',
            filename: 'script_robot.robot',
          },
        ],
      },
      {
        title: 'Documents',
        files: [
          { id: 'id-report.pdf', label: 'PDF report', filename: 'report.pdf' },
        ],
      },
      {
        title: 'Data',
        files: [
          {
            id: 'id-recording.json',
            label: 'Recording (JSON)',
            filename: 'recording.json',
          },
        ],
      },
      {
        title: 'Other files',
        files: [
          {
            id: 'id-zz-notes.txt',
            label: 'zz-notes.txt',
            filename: 'zz-notes.txt',
          },
        ],
      },
    ])
  })

  it('finds screenshots by filename', () => {
    const shots = screenshotIds([
      artifact('shot.jpg', 'image/jpeg'),
      artifact('legacy.jpg', 'application/octet-stream'),
    ])
    expect([...shots]).toEqual([['shot.jpg', 'id-shot.jpg']])
  })
})

describe('errorPage', () => {
  it('explains each failure', () => {
    expect(errorPage(403, 'An active paid plan is required.')).toBe(
      PLAN_REQUIRED
    )
    expect(
      errorPage(403, 'Verify your primary email in Clerk before continuing.')
    ).toMatchObject({
      title: 'Verify your email',
      action: { href: '/sign-in' },
    })
    expect(
      errorPage(403, 'This account is suspended. Contact QA Ninja support.')
    ).toEqual({
      title: 'Account suspended',
      message: 'This account is suspended. Contact QA Ninja support.',
      action: undefined,
    })
    expect(errorPage(404, 'Recording not found.', { recording: true })).toBe(
      RECORDING_MISSING
    )
    expect(errorPage(404, 'Not found.')).toBe(NOT_FOUND)
    expect(errorPage(404, 'Run not found.', { run: true })).toBe(RUN_MISSING)
    expect(errorPage(403, 'Execute is not available yet.')).toBe(
      EXECUTE_UNAVAILABLE
    )
    expect(errorPage(422, 'Invalid.')).toBe(BAD_LINK)
    expect(errorPage(502, 'Billing is temporarily unavailable.')).toMatchObject(
      {
        title: 'Something went wrong',
        message: 'Billing is temporarily unavailable.',
      }
    )
  })
})

describe('stepTitle', () => {
  const step = { url: 'https://shop.example.com/login', xpath: '//input[1]' }

  it('reads clicks and version 1 steps as their label, as before', () => {
    expect(stepTitle({ ...step, label: 'Click checkout' })).toBe(
      'Click checkout'
    )
    expect(stepTitle(step)).toBe('Click')
    expect(stepTitle({ ...step, label: '' })).toBe('Click')
    expect(stepTitle({ ...step, label: 'Sign in', action_type: 'click' })).toBe(
      'Sign in'
    )
  })

  it('reads version 2 steps as their action', () => {
    expect(
      stepTitle({
        ...step,
        action_type: 'fill',
        label: 'Email',
        value: 'qa@example.com',
      })
    ).toBe('Typed "qa@example.com" into Email')
    expect(
      stepTitle({ ...step, action_type: 'fill', label: 'Email', value: '' })
    ).toBe('Cleared Email')
    expect(
      stepTitle({
        ...step,
        action_type: 'fill',
        label: 'Email',
        value: '',
        value_ref: { kind: 'input', name: 'email_1' },
      })
    ).toBe('Typed an input (email_1) into Email')
    expect(
      stepTitle({
        ...step,
        action_type: 'select',
        label: 'Country',
        value: 'Canada',
      })
    ).toBe('Selected "Canada" in Country')
    expect(
      stepTitle({ ...step, action_type: 'check', label: 'Remember me' })
    ).toBe('Checked Remember me')
    expect(
      stepTitle({ ...step, action_type: 'uncheck', label: 'Newsletter' })
    ).toBe('Unchecked Newsletter')
    expect(stepTitle({ ...step, action_type: 'press', key: 'Tab' })).toBe(
      'Pressed Tab'
    )
    expect(stepTitle({ ...step, action_type: 'press' })).toBe('Pressed Enter')
    expect(
      stepTitle({
        url: 'https://shop.example.com/orders',
        action_type: 'navigate',
      })
    ).toBe('Opened https://shop.example.com/orders')
    expect(stepTitle({ ...step, action_type: 'fill' })).toBe('Cleared a field')
  })

  it('never shows a value for a sensitive step', () => {
    const secret = {
      ...step,
      action_type: 'fill',
      label: 'Password',
      sensitive: true,
      value_ref: { kind: 'secret' as const, name: 'password_1' },
    }
    expect(stepTitle(secret)).toBe('Typed a secret (password_1) into Password')
    // Even if a value slipped through, it isn't shown.
    expect(stepTitle({ ...secret, value: 'hunter2' })).toBe(
      'Typed a secret (password_1) into Password'
    )
    expect(stepTitle({ ...secret, value: 'hunter2', value_ref: null })).toBe(
      'Typed a secret into Password'
    )
    expect(
      stepTitle({
        ...step,
        action_type: 'select',
        label: 'Card',
        sensitive: true,
        value: '4242',
      })
    ).toBe('Selected an option in Card')
  })
})
