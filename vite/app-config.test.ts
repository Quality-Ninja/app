import { describe, expect, it } from 'vitest'
import { DEFAULT_EXTENSION_ID, readAppConfig } from './app-config.ts'
import { clerkScripts, contentSecurityPolicy } from './qaninja-html.ts'

const live = {
  API_BASE_URL: 'https://api.qaninja.studio/',
  CLERK_PUBLISHABLE_KEY: 'pk_live_Y2xlcmsucWFuaW5qYS5zdHVkaW8k',
  CLERK_FRONTEND_API: 'https://clerk.qaninja.studio',
  EXTENSION_ID: 'abcdefghijklmnopabcdefghijklmnop',
  APP_ENV: 'production',
}

describe('readAppConfig', () => {
  it('reads the public settings and trims trailing slashes', () => {
    expect(readAppConfig(live)).toEqual({
      apiBaseUrl: 'https://api.qaninja.studio',
      clerkPublishableKey: 'pk_live_Y2xlcmsucWFuaW5qYS5zdHVkaW8k',
      clerkFrontendApi: 'https://clerk.qaninja.studio',
      extensionId: 'abcdefghijklmnopabcdefghijklmnop',
    })
  })

  it('defaults to the local API and the development extension', () => {
    expect(readAppConfig({})).toEqual({
      apiBaseUrl: 'http://localhost:8000',
      clerkPublishableKey: '',
      clerkFrontendApi: '',
      extensionId: 'omlmffaaomacajicfhfofoackdnfocdg',
    })
    expect(readAppConfig({ EXTENSION_ID: '  ' }).extensionId).toBe(
      DEFAULT_EXTENSION_ID
    )
  })

  it('refuses anything but a Chrome extension ID', () => {
    expect(
      readAppConfig({ EXTENSION_ID: ' omlmffaaomacajicfhfofoackdnfocdg ' })
        .extensionId
    ).toBe('omlmffaaomacajicfhfofoackdnfocdg')
    for (const id of [
      'omlmffaaomacajicfhfofoackdnfocd',
      'omlmffaaomacajicfhfofoackdnfocdgg',
      'OMLMFFAAOMACAJICFHFOFOACKDNFOCDG',
      'qmlmffaaomacajicfhfofoackdnfocdg',
      'omlmffaaomacajicfhfofoackdnfocd1',
      'chrome-extension://omlmffaaomacajicfhfofoackdnfocdg',
    ])
      expect(() => readAppConfig({ EXTENSION_ID: id })).toThrow(
        'EXTENSION_ID must be a Chrome extension ID'
      )
  })

  it('refuses anything but an origin', () => {
    expect(() =>
      readAppConfig({ API_BASE_URL: 'https://api.example.com/v1' })
    ).toThrow('apiBaseUrl must be an origin')
    expect(() =>
      readAppConfig({ CLERK_FRONTEND_API: 'clerk.example.com' })
    ).toThrow('clerkFrontendApi must be an origin')
    expect(() => readAppConfig({ API_BASE_URL: 'https://' })).toThrow(
      'must be an origin'
    )
  })

  it('refuses a secret key', () => {
    expect(() =>
      readAppConfig({ CLERK_PUBLISHABLE_KEY: 'sk_live_secret' })
    ).toThrow('Never put a secret key in the web app.')
  })

  it('holds production builds to HTTPS and a live key', () => {
    expect(() =>
      readAppConfig({ ...live, API_BASE_URL: 'http://api.qaninja.studio' })
    ).toThrow('Production builds need HTTPS')
    expect(() =>
      readAppConfig({
        ...live,
        CLERK_PUBLISHABLE_KEY: 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk',
      })
    ).toThrow('Production builds need HTTPS')
    expect(() =>
      readAppConfig({
        ...live,
        APP_ENV: 'staging',
        API_BASE_URL: 'http://localhost:8000',
      })
    ).not.toThrow()
  })
})

describe('index.html', () => {
  const config = readAppConfig(live)

  it('builds the CSP from the configured origins', () => {
    expect(contentSecurityPolicy(config)).toBe(
      [
        "default-src 'self'",
        "script-src 'self' https://clerk.qaninja.studio https://challenges.cloudflare.com https://*.protect.clerk.com",
        "connect-src 'self' https://api.qaninja.studio https://clerk.qaninja.studio https://*.protect.clerk.com:*",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://img.clerk.com",
        "worker-src 'self' blob:",
        'frame-src https://challenges.cloudflare.com https://*.protect.clerk.com',
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; ')
    )
  })

  it('keeps the policy narrow without Clerk', () => {
    const local = readAppConfig({})
    expect(contentSecurityPolicy(local)).toBe(
      "default-src 'self'; script-src 'self'; connect-src 'self' http://localhost:8000; style-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'"
    )
    expect(clerkScripts(local)).toMatch(/^<!-- Sign-in is not configured/)
  })

  it('loads Clerk UI, then clerk-js with the publishable key', () => {
    const tags = clerkScripts(config)
    expect(tags.indexOf('@clerk/ui@1/dist/ui.browser.js')).toBeLessThan(
      tags.indexOf('@clerk/clerk-js@6/dist/clerk.browser.js')
    )
    expect(tags).toContain(
      'data-clerk-publishable-key="pk_live_Y2xlcmsucWFuaW5qYS5zdHVkaW8k"'
    )
  })
})
