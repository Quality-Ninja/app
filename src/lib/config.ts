// Public build settings only (see .env.example and vite/app-config.ts). Never put a secret here.
export const config = __APP_CONFIG__

export const clerkConfigured = Boolean(
  config.clerkPublishableKey && config.clerkFrontendApi
)
