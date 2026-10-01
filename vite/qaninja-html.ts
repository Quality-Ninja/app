// Fills index.html's placeholders: Clerk's browser scripts (from the Clerk Frontend API, in dev and build) and the
// Content-Security-Policy (build only: the dev server injects an inline React-refresh preamble and inline styles that the
// policy would block). After a build, 404.html is written as a copy of index.html, so a path that isn't a page gets a
// real 404 status from Render and serve.js while the router shows "Page not found".
import { copyFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin } from 'vite'
import { type AppConfig, clerkConfigured } from './app-config.ts'

// The policy the API used to send with each page, plus the API origin and blob: images for screenshots.
// frame-ancestors can't be set from a meta tag; render.yaml and serve.js send it as a header.
export function contentSecurityPolicy(config: AppConfig) {
  const clerk = clerkConfigured(config)
  return [
    "default-src 'self'",
    `script-src 'self'${clerk ? ` ${config.clerkFrontendApi} https://challenges.cloudflare.com https://*.protect.clerk.com` : ''}`,
    `connect-src 'self' ${config.apiBaseUrl}${clerk ? ` ${config.clerkFrontendApi} https://*.protect.clerk.com:*` : ''}`,
    `style-src 'self'${clerk ? " 'unsafe-inline'" : ''}`,
    `img-src 'self' data: blob:${clerk ? ' https://img.clerk.com' : ''}`,
    ...(clerk
      ? [
          "worker-src 'self' blob:",
          'frame-src https://challenges.cloudflare.com https://*.protect.clerk.com',
        ]
      : []),
    "base-uri 'none'",
    "form-action 'self'",
  ].join('; ')
}

// Clerk's UI bundle, then clerk-js, which reads the publishable key from its own tag. Both are deferred, so they run
// before the app's module entry, which Vite places after them.
export function clerkScripts(config: AppConfig) {
  if (!clerkConfigured(config)) {
    return '<!-- Sign-in is not configured: CLERK_PUBLISHABLE_KEY and CLERK_FRONTEND_API are empty. -->'
  }
  return [
    `<script defer crossorigin="anonymous" src="${config.clerkFrontendApi}/npm/@clerk/ui@1/dist/ui.browser.js"></script>`,
    `<script defer crossorigin="anonymous" data-clerk-publishable-key="${config.clerkPublishableKey}" src="${config.clerkFrontendApi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js"></script>`,
  ].join('\n    ')
}

export function qaninjaHtml(config: AppConfig): Plugin {
  return {
    name: 'qaninja-html',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        const csp = context.server
          ? ''
          : `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(config)}">`
        const filled = html
          .replace('<!-- @csp -->', csp)
          .replace('<!-- @clerk -->', clerkScripts(config))
        if (filled.includes('<!-- @')) {
          throw new Error('index.html still has an unfilled placeholder.')
        }
        return filled
      },
    },
    async writeBundle(options) {
      if (!options.dir) return
      await copyFile(
        path.join(options.dir, 'index.html'),
        path.join(options.dir, '404.html')
      )
    },
  }
}
