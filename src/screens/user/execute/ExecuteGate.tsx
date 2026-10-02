import { Link } from '@tanstack/react-router'
import type { Capabilities } from '@/lib/types'
import { EmptyState } from '@/components/EmptyState'

// Without Execute: a paid plan unlocks it, or (on a paid plan) the service hasn't turned it on yet.
export function ExecuteGate({ caps }: { caps: Capabilities }) {
  if (caps.recording)
    return (
      <EmptyState title='Execute is coming soon'>
        <p>
          Running your recorded tests with agents is almost ready. Your
          recordings are here when it arrives.
        </p>
      </EmptyState>
    )
  return (
    <EmptyState title='Run your tests with agents on a paid plan'>
      <p>
        Execute replays your recorded tests in this Chrome, and an agent fixes
        broken steps and judges the outcome. It comes with Basic and
        Supercharged.
      </p>
      <Link className='button primary' to='/account'>
        See plans
      </Link>
    </EmptyState>
  )
}
