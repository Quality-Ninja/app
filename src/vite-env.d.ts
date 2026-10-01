/// <reference types="vite/client" />

// Public build settings, validated by vite/app-config.ts and inlined by vite.config.ts.
declare const __APP_CONFIG__: {
  readonly apiBaseUrl: string
  readonly clerkPublishableKey: string
  readonly clerkFrontendApi: string
}
