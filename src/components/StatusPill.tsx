import { STATUSES, STEP_STATUSES } from '@/lib/execute'
import type { RunStatus, StepStatus } from '@/lib/types'

// Where a run is: queued and running ones are live (the dot pulses while running), the rest have ended.
export function StatusPill({ status }: { status: RunStatus }) {
  return (
    <span className={`badge status-${status}`} data-status={status}>
      {STATUSES[status]}
    </span>
  )
}

// How one step of a run went; 'pending' is a step the run hasn't reached.
export function StepStatusPill({ status }: { status: StepStatus | 'pending' }) {
  return (
    <span className={`badge step-${status}`} data-step-status={status}>
      {STEP_STATUSES[status]}
    </span>
  )
}
