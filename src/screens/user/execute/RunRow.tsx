import { Link } from '@tanstack/react-router'
import {
  MODE_INFO,
  agentText,
  formatDuration,
  progressText,
  stepsText,
} from '@/lib/execute'
import type { RunSummary } from '@/lib/types'
import { LocalTime } from '@/components/LocalTime'
import { StatusPill } from '@/components/StatusPill'
import { VerdictBadge } from '@/components/VerdictBadge'

// A run's verdict, and its status unless it simply completed.
export function RunBadges({ run }: { run: RunSummary }) {
  return (
    <span className='run-badges'>
      {run.verdict ? <VerdictBadge verdict={run.verdict} /> : null}
      {run.status !== 'completed' || !run.verdict ? (
        <StatusPill status={run.status} />
      ) : null}
    </span>
  )
}

// One run on the trail: the test, how it went, who ran it, and when. The name opens the run; `heading` fits it
// into the page's outline.
export function RunRow({
  run,
  heading: Heading = 'h2',
}: {
  run: RunSummary
  heading?: 'h2' | 'h3' | 'h4'
}) {
  const duration = formatDuration(run.duration_ms)
  const progress = progressText(run)
  return (
    <li className='run-row' data-run-id={run.id}>
      <div>
        <Heading className='run-name'>
          <Link to='/execute/runs/$id' params={{ id: run.id }}>
            {run.name}
          </Link>
        </Heading>
        <p className='meta'>
          {MODE_INFO[run.mode].label} · {agentText(run)}
          {run.created_at ? (
            <>
              {' · '}
              <LocalTime value={run.created_at} />
            </>
          ) : null}
        </p>
        <p className='meta'>
          {stepsText(run)}
          {duration ? ` · ${duration}` : ''}
          {progress ? ` · ${progress}` : ''}
        </p>
      </div>
      <RunBadges run={run} />
    </li>
  )
}
