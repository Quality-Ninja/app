// Presentation rules the API used to apply in its page templates: plan names, file groups, times, the sign-in
// allowlist, and the error pages.
import type { Artifact, PaidPlan, PlanCode, RecordingStep } from './types'

const PLAN_NAMES: Record<PlanCode, string> = {
  FREE: 'XPath Finder (free)',
  BASIC: 'Basic',
  SUPER: 'Supercharged',
}

export type Plan = {
  code: PaidPlan
  name: string
  monthly: string
  yearly: string
  storage: string
}

// Prices and storage as shown on the account page. Stripe price IDs live in the API's environment.
export const PLANS: Plan[] = [
  {
    code: 'BASIC',
    name: 'Basic',
    monthly: '$7.99',
    yearly: '$79.99',
    storage: '25 dashboard recordings',
  },
  {
    code: 'SUPER',
    name: 'Supercharged',
    monthly: '$14.99',
    yearly: '$149.99',
    storage: 'Unlimited dashboard recordings',
  },
]

// Friendly names for the files the extension uploads (extension/exports.mjs); anything else is listed under "Other files".
const FILE_GROUPS: [title: string, labels: Record<string, string>][] = [
  [
    'Scripts',
    {
      'script_playwright.py': 'Playwright (Python)',
      'script_selenium.py': 'Selenium (Python)',
      'script_cypress.cy.js': 'Cypress',
      'script_robot.robot': 'Robot Framework',
    },
  ],
  [
    'Documents',
    {
      'report.pdf': 'PDF report',
      'documentation_en.txt': 'Steps in English',
      'documentation_es.txt': 'Steps in Spanish',
      'documentation_jp.txt': 'Steps in Japanese',
      'README.txt': 'Read me',
    },
  ],
  ['Data', { 'recording.json': 'Recording (JSON)', 'data.csv': 'Steps (CSV)' }],
]
const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

export const planName = (code: string) =>
  PLAN_NAMES[code as PlanCode] ?? String(code)

// SQLite CURRENT_TIMESTAMP is UTC without a zone; mark it so browsers don't read it as local time.
export function utcIso(value: unknown) {
  const text = String(value ?? '')
  return SQLITE_TIMESTAMP.test(text) ? text.replace(' ', 'T') + 'Z' : text
}

// Screenshot artifacts by filename, for the steps that show them.
export const screenshotIds = (artifacts: Artifact[]) =>
  new Map(
    artifacts
      .filter((artifact) => artifact.media_type === 'image/jpeg')
      .map((artifact) => [artifact.filename, artifact.id])
  )

export type FileGroup = {
  title: string
  files: { id: string; label: string; filename: string }[]
}

type GroupKey = [group: number, position: number, name: string]

// Downloads for the recording page. Screenshots a step displays are left out; they appear with their step.
export function groupFiles(
  artifacts: Artifact[],
  steps: RecordingStep[]
): FileGroup[] {
  const withSteps = new Set(
    steps.map((step) => step.screenshot).filter(Boolean)
  )
  const known = new Map<string, GroupKey>()
  FILE_GROUPS.forEach(([, labels], index) =>
    Object.entries(labels).forEach(([filename, label], order) =>
      known.set(filename, [index, order, label])
    )
  )
  const key = (artifact: Artifact): GroupKey =>
    known.get(artifact.filename) ?? [FILE_GROUPS.length, 0, artifact.filename]
  const groups: FileGroup[] = [
    ...FILE_GROUPS.map(([title]) => ({ title, files: [] })),
    { title: 'Other files', files: [] },
  ]
  for (const artifact of [...artifacts].sort((a, b) =>
    compare(key(a), key(b))
  )) {
    if (withSteps.has(artifact.filename)) continue
    const [index, , label] = key(artifact)
    groups[index].files.push({
      id: artifact.id,
      label,
      filename: artifact.filename,
    })
  }
  return groups.filter((group) => group.files.length)
}

// Orders [group, position, name] keys the way the API's Python sorted its tuples.
function compare(a: GroupKey, b: GroupKey) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1
    if (a[i] > b[i]) return 1
  }
  return 0
}

// No arbitrary URLs, query strings, encoded paths or fragments cross the sign-in boundary.
export function safeNext(value: string) {
  if (['/dashboard', '/account', '/account?checkout=success'].includes(value))
    return value
  if (/^\/workflow\/[1-9][0-9]{0,17}$/.test(value)) return value
  return '/dashboard'
}

export const isWorkflowId = (value: string) => /^[1-9][0-9]{0,17}$/.test(value)

export type ErrorInfo = {
  title: string
  message: string
  action?: { label: string; href: string }
}

const page = (
  title: string,
  message: string,
  action?: ErrorInfo['action']
): ErrorInfo => ({ title, message, action })

const toRecordings = { label: 'Go to recordings', href: '/dashboard' }

export const PLAN_REQUIRED = page(
  'Viewing recordings needs an active plan',
  'Your recordings are safe. You can still download or delete them from your recordings list.',
  { label: 'See plans', href: '/account' }
)
export const RECORDING_MISSING = page(
  "We couldn't find that recording",
  'It may have been deleted, or it belongs to another account.',
  toRecordings
)
export const BAD_LINK = page(
  "That link doesn't look right",
  'Check the address, or go back to your recordings.',
  toRecordings
)
export const NOT_FOUND = page(
  'Page not found',
  'Check the address, or go back to your recordings.',
  toRecordings
)

// The page to show when loading a page's data fails. Messages come from the API, which never echoes input.
export function errorPage(
  status: number,
  detail: string,
  { recording = false } = {}
): ErrorInfo {
  if (status === 403) {
    if (/email/i.test(detail))
      return page('Verify your email', detail, {
        label: 'Sign in',
        href: '/sign-in',
      })
    // A suspended account can't use any page, so there is nowhere to send it; Sign out stays in the header.
    if (/suspended/i.test(detail)) return page('Account suspended', detail)
    return PLAN_REQUIRED
  }
  if (status === 404) return recording ? RECORDING_MISSING : NOT_FOUND
  if (status === 422) return BAD_LINK
  return page('Something went wrong', detail, toRecordings)
}
