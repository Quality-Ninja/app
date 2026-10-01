import { describe, expect, it } from 'vitest'
import type { Artifact } from './types'
import {
  BAD_LINK,
  NOT_FOUND,
  PLAN_REQUIRED,
  RECORDING_MISSING,
  errorPage,
  groupFiles,
  isWorkflowId,
  planName,
  safeNext,
  screenshotIds,
  utcIso,
} from './views'

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
    ])
      expect(safeNext(next)).toBe('/dashboard')
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
    expect(errorPage(422, 'Invalid.')).toBe(BAD_LINK)
    expect(errorPage(502, 'Billing is temporarily unavailable.')).toMatchObject(
      {
        title: 'Something went wrong',
        message: 'Billing is temporarily unavailable.',
      }
    )
  })
})
