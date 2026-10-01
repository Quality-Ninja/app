import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import { api, download } from '@/lib/api'
import type { WorkflowDetail } from '@/lib/types'
import { groupFiles, screenshotIds } from '@/lib/views'
import { useTitle } from '@/hooks/useTitle'
import { ActionButton } from '@/components/ActionButton'
import { QueryError } from '@/components/ErrorView'
import { LocalTime } from '@/components/LocalTime'
import { Page } from '@/components/Page'
import { BackIcon } from '@/components/icons'
import { StepItem } from './StepItem'

// One recording: every file it saved, and its steps with screenshots.
export function Workflow({ id }: { id: string }) {
  const { data, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => api<WorkflowDetail>(`/workflows/${id}`),
  })
  useTitle(
    error ? null : data ? `${data.name} · QA Ninja` : 'Recording · QA Ninja'
  )
  const target = useLocation({
    select: (location) => /^step-([1-9][0-9]*)$/.exec(location.hash)?.[1],
  })

  // A linked step (#step-N) only exists once the recording has loaded, so scroll to it then.
  useEffect(() => {
    if (data && target)
      document
        .getElementById(`step-${target}`)
        ?.scrollIntoView({ block: 'start' })
  }, [data, target])

  if (error)
    return (
      <Page>
        <QueryError error={error} recording />
      </Page>
    )
  if (!data) return <Page busy />

  const steps = data.recording?.steps ?? []
  const artifacts = data.artifacts ?? []
  const groups = groupFiles(artifacts, steps)
  const shots = screenshotIds(artifacts)
  const zip = `/workflows/${data.id}/download`
  return (
    <Page>
      <Link className='back-link' to='/dashboard'>
        <BackIcon />
        Recordings
      </Link>
      <div className='page-head'>
        <div>
          <h1>{data.name}</h1>
          <p className='meta'>
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}, recorded{' '}
            <LocalTime value={data.created_at} />
          </p>
        </div>
        <ActionButton
          className='primary'
          data-download={zip}
          onAction={() => download(zip)}
        >
          Download all files (ZIP)
        </ActionButton>
      </div>
      {groups.length ? (
        <section aria-labelledby='files-title'>
          <h2 id='files-title'>Files</h2>
          <div className='download-groups'>
            {groups.map((group) => (
              <div key={group.title} className='download-group'>
                <h3>{group.title}</h3>
                <ul role='list'>
                  {group.files.map((file) => {
                    const path = `/workflows/${data.id}/files/${file.id}`
                    return (
                      <li key={file.id}>
                        <ActionButton
                          className='link-button'
                          data-download={path}
                          onAction={() => download(path)}
                        >
                          {file.label}
                        </ActionButton>
                        {file.label !== file.filename ? (
                          <span className='meta code'>{file.filename}</span>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section aria-labelledby='steps-title'>
        <h2 id='steps-title'>Steps</h2>
        <ol className='step-list'>
          {steps.map((step, index) => (
            <StepItem
              key={index}
              workflowId={data.id}
              step={step}
              n={index + 1}
              shot={step.screenshot ? shots.get(step.screenshot) : undefined}
              current={target === String(index + 1)}
            />
          ))}
        </ol>
      </section>
    </Page>
  )
}
