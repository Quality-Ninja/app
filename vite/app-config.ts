// Public build settings (see .env.example). Every value lands in the page, in HTML attributes and the CSP, so each
// must be exactly an origin or a publishable key. The names are the ones set in the Render dashboard.

export type AppConfig = {
  apiBaseUrl: string
  clerkPublishableKey: string
  clerkFrontendApi: string
}

type Env = Record<string, string | undefined>

const trimmed = (env: Env, name: string) =>
  (env[name] ?? '').trim().replace(/\/+$/, '')

function isOrigin(value: string) {
  try {
    return /^https?:\/\//.test(value) && new URL(value).origin === value
  } catch {
    return false
  }
}

export function readAppConfig(env: Env): AppConfig {
  const config: AppConfig = {
    apiBaseUrl: trimmed(env, 'API_BASE_URL') || 'http://localhost:8000',
    clerkPublishableKey: trimmed(env, 'CLERK_PUBLISHABLE_KEY'),
    clerkFrontendApi: trimmed(env, 'CLERK_FRONTEND_API'),
  }
  for (const name of ['apiBaseUrl', 'clerkFrontendApi'] as const) {
    const value = config[name]
    if (value && !isOrigin(value)) {
      throw new Error(
        `${name} must be an origin such as https://api.example.com, with no path.`
      )
    }
  }
  if (
    config.clerkPublishableKey &&
    !/^pk_(test|live)_[A-Za-z0-9_-]+$/.test(config.clerkPublishableKey)
  ) {
    throw new Error(
      'CLERK_PUBLISHABLE_KEY must be a Clerk publishable key (pk_…). Never put a secret key in the web app.'
    )
  }
  if (
    env.APP_ENV === 'production' &&
    (!config.apiBaseUrl.startsWith('https://') ||
      !config.clerkFrontendApi.startsWith('https://') ||
      !config.clerkPublishableKey.startsWith('pk_live_'))
  ) {
    throw new Error(
      'Production builds need HTTPS API_BASE_URL and CLERK_FRONTEND_API, and a live Clerk key (pk_live_…).'
    )
  }
  return config
}

export const clerkConfigured = (config: AppConfig) =>
  Boolean(config.clerkPublishableKey && config.clerkFrontendApi)
