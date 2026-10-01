// Response shapes of the QA Ninja API (api/product_routes.py), field for field.

export type PlanCode = 'FREE' | 'BASIC' | 'SUPER'

// GET /me/capabilities and GET /me/account
export type Capabilities = {
  user_id: number
  email: string
  plan: PlanCode
  recording: boolean
  cloud_save: boolean
  // BASIC 25, SUPER null (unlimited), FREE 0
  cloud_limit: number | null
  cloud_used: number
  valid_until: number
  access_source: 'stripe' | 'support_grant' | 'free'
}

// GET /workflows, newest first. Saved recordings outlive a subscription for download and delete.
export type PlanSummary = {
  id: number
  name: string
  created_at: string
  steps: number
}

export type Artifact = {
  id: string
  filename: string
  media_type: string
}

// One recorded step as the extension saves it (extension/exports.mjs). Recordings migrated from before the extension's
// schema keep their screenshot under screenshot_path; those files aren't previewable.
export type RecordingStep = {
  url: string
  xpath: string
  label?: string
  screenshot?: string | null
  screenshot_path?: string | null
  timestamp?: string
  frameId?: number | string | null
}

export type RecordingManifest = {
  schema_version?: number
  id?: string
  name?: string
  created_at?: string
  steps?: RecordingStep[]
}

// GET /workflows/{id}. Needs an active plan (403 otherwise).
export type WorkflowDetail = {
  id: number
  name: string
  created_at: string
  recording: RecordingManifest
  artifacts: Artifact[]
}

export type PaidPlan = Exclude<PlanCode, 'FREE'>
export type BillingInterval = 'monthly' | 'yearly'

// POST /billing/checkout body
export type CheckoutBody = { plan: PaidPlan; interval: BillingInterval }

// POST /billing/checkout and POST /billing/portal
export type UrlResponse = { url: string }
