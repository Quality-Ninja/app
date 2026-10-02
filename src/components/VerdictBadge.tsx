import { VERDICTS } from '@/lib/execute'
import type { Verdict } from '@/lib/types'

// A run's verdict. The word carries it; the color repeats it: passed is ok green, failed is signal red, blocked stays
// muted (the run couldn't decide, for a reason the run page gives).
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={`badge verdict-${verdict.toLowerCase()}`}
      data-verdict={verdict}
    >
      {VERDICTS[verdict]}
    </span>
  )
}
