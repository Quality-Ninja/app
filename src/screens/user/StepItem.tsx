import type { RecordingStep } from '@/lib/types'
import { stepTitle } from '@/lib/views'
import { CopyButton } from '@/components/CopyButton'
import { LocalTime } from '@/components/LocalTime'
import { Screenshot } from '@/components/Screenshot'

// One recorded step on the trail: what it did (a click reads as its label), where, its XPath, and its screenshot. A step
// with no XPath (opening a page) has no XPath box. `current` is the step a #step-N link points at; it wears the target
// frame and takes the waypoint over from the last step.
export function StepItem({
  workflowId,
  step,
  n,
  shot,
  current,
}: {
  workflowId: number
  step: RecordingStep
  n: number
  shot?: string
  current: boolean
}) {
  const label = stepTitle(step)
  return (
    <li
      id={`step-${n}`}
      className='step'
      aria-current={current ? 'step' : undefined}
    >
      <div className='step-grid'>
        <div>
          <h3 className='step-label'>{label}</h3>
          <p className='step-url meta' title={step.url}>
            {step.url}
          </p>
          {step.xpath ? (
            <div className='well'>
              <code>{step.xpath}</code>
              <CopyButton text={step.xpath} label={`for step ${n}`} />
            </div>
          ) : null}
          <p className='step-meta meta'>
            {step.timestamp ? (
              <LocalTime value={step.timestamp} kind='time' />
            ) : null}
            {step.frameId ? <span>Frame {step.frameId}</span> : null}
          </p>
        </div>
        {shot ? (
          <Screenshot
            path={`/workflows/${workflowId}/preview/${shot}`}
            alt={`Step ${n} screenshot: ${label}`}
          />
        ) : null}
      </div>
    </li>
  )
}
