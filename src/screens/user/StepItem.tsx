import type { RecordingStep } from '@/lib/types'
import { useScreenshot } from '@/hooks/useScreenshot'
import { CopyButton } from '@/components/CopyButton'
import { LocalTime } from '@/components/LocalTime'

// One recorded step on the trail: what was clicked, where, its XPath, and its screenshot. `current` is the step a
// #step-N link points at; it wears the target frame and takes the waypoint over from the last step.
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
  const label = step.label || 'Click'
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
          <div className='well'>
            <code>{step.xpath}</code>
            <CopyButton text={step.xpath} label={`for step ${n}`} />
          </div>
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

// The link and image get their blob: URL once the screenshot has loaded (useScreenshot).
function Screenshot({ path, alt }: { path: string; alt: string }) {
  const { ref, url } = useScreenshot(path)
  return (
    <a
      ref={ref}
      className='step-shot'
      href={url}
      target='_blank'
      rel='noopener'
      data-shot={path}
    >
      <img alt={alt} src={url} />
    </a>
  )
}
