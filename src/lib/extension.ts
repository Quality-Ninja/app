// The dashboard's channel to the QA Ninja extension: chrome.runtime.sendMessage to the configured extension ID, which
// the extension accepts from this site only (externally_connectable). Chrome exposes chrome.runtime to the page only
// when an installed extension lets it connect, so a missing runtime, a thrown call, or chrome.runtime.lastError all
// mean the extension isn't there. execute.ts reads the answers.
import { config } from './config'
import {
  type ExtensionInfo,
  type RunAnswer,
  readPing,
  readRunAnswer,
} from './execute'

type Runtime = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void
  lastError?: { message?: string } | null
}

const TIMEOUT = Symbol('timeout')

function send(message: unknown, wait: number) {
  const runtime = (globalThis as { chrome?: { runtime?: Runtime } }).chrome
    ?.runtime
  const sendMessage = runtime?.sendMessage
  if (!runtime || typeof sendMessage !== 'function')
    return Promise.resolve(null)
  return new Promise<unknown>((resolve) => {
    const timer = window.setTimeout(() => resolve(TIMEOUT), wait)
    const done = (value: unknown) => {
      window.clearTimeout(timer)
      resolve(value)
    }
    try {
      sendMessage.call(runtime, config.extensionId, message, (response) =>
        done(runtime.lastError ? null : response)
      )
    } catch {
      done(null)
    }
  })
}

// Is the extension installed here, and who is signed in to it? null when it isn't installed or doesn't answer.
export async function pingExtension(): Promise<ExtensionInfo | null> {
  const answer = await send({ type: 'QANINJA_PING' }, 3000)
  return answer === TIMEOUT ? null : readPing(answer)
}

// Ask the extension to start a queued run, as this account (the Clerk subject). 'timeout' means it may still be
// starting: it claims the run with its own sign-in, and the run page shows what happened.
export async function startOnExtension(
  runId: string,
  subject: string
): Promise<RunAnswer | 'timeout' | null> {
  const answer = await send(
    { type: 'QANINJA_RUN', runId, subject, consent: true },
    20_000
  )
  return answer === TIMEOUT ? 'timeout' : readRunAnswer(answer)
}

// The first run on this browser asks for consent (screens/user/execute/RunButton.tsx); this browser remembers it.
// Storage can be unavailable (blocked cookies, private modes), and then the question is asked again.
const CONSENT_KEY = 'qaninja.execute.consent'

export function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    // Not remembered: the next run asks again.
  }
}

// OpenRouter sign-in: the state the API issued waits in this tab until OpenRouter sends the visitor back.
const OPENROUTER_KEY = 'qaninja.openrouter.state'

export function saveOpenRouterState(state: string) {
  try {
    sessionStorage.setItem(OPENROUTER_KEY, state)
    return true
  } catch {
    return false
  }
}

// Read once: the API accepts a state only one time.
export function takeOpenRouterState() {
  try {
    const state = sessionStorage.getItem(OPENROUTER_KEY)
    sessionStorage.removeItem(OPENROUTER_KEY)
    return state
  } catch {
    return null
  }
}
