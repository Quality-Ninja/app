import { useEffect } from 'react'
import { ApiError } from '@/lib/api'
import { type ErrorInfo, errorPage } from '@/lib/views'
import { useNotice } from '@/hooks/useNotice'
import { useTitle } from '@/hooks/useTitle'

export function ErrorView({
  info,
  status,
}: {
  info: ErrorInfo
  status?: number
}) {
  useTitle(`${info.title} · QA Ninja`)
  return (
    <section className='error-page'>
      <h1>{info.title}</h1>
      <p className='lede'>{info.message}</p>
      {info.action ? (
        <a className='button primary' href={info.action.href}>
          {info.action.label}
        </a>
      ) : null}
      {status ? <p className='meta'>Error {status}</p> : null}
    </section>
  )
}

// A page whose data didn't load: a 401 has already sent the visitor to sign in, the API's other answers get an error
// page, and anything else (a network failure) goes to the notice.
export function QueryError({
  error,
  recording = false,
  run = false,
}: {
  error: Error
  recording?: boolean
  run?: boolean
}) {
  const { say } = useNotice()
  const answer = error instanceof ApiError ? error : null
  useEffect(() => {
    if (!answer) say(error.message, true)
  }, [answer, error, say])
  if (!answer || answer.status === 401) return null
  return (
    <ErrorView
      info={errorPage(answer.status, answer.message, { recording, run })}
      status={answer.status}
    />
  )
}
