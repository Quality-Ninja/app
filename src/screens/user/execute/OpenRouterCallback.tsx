import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ApiError, api, errorMessage } from '@/lib/api'
import { takeOpenRouterState } from '@/lib/extension'
import type { NewConnection } from '@/lib/types'
import type { ErrorInfo } from '@/lib/views'
import { useTitle } from '@/hooks/useTitle'
import { useToast } from '@/hooks/useToast'
import { ErrorView } from '@/components/ErrorView'
import { Page } from '@/components/Page'

const failed = (message: string): ErrorInfo => ({
  title: "We couldn't connect OpenRouter",
  message,
  action: { label: 'Back to agents', href: '/execute?tab=agents' },
})

const NO_CODE = failed(
  "OpenRouter didn't send a sign-in code back. Start again from Agents."
)

// The state the Agents tab saved isn't in this tab: the sign-in began elsewhere, or this page already used it.
class MissingState extends Error {}

// One request per code: the API accepts a state once, and React may run the effect twice (development) before the
// page moves on.
const completions = new Map<string, Promise<NewConnection>>()

function complete(code: string) {
  let pending = completions.get(code)
  if (!pending) {
    const state = takeOpenRouterState()
    pending = state
      ? api<NewConnection>('/execute/connections/openrouter/complete', {
          method: 'POST',
          body: { state, code },
        })
      : Promise.reject(
          new MissingState(
            'This sign-in started in another tab, or it already finished. Start again from Agents.'
          )
        )
    completions.set(code, pending)
  }
  return pending
}

type Failure = { info: ErrorInfo; status?: number }

// OpenRouter's callback: finish the connection, then go to Agents with a toast. Failures explain themselves here.
export function OpenRouterCallback({ code }: { code?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [failure, setFailure] = useState<Failure | null>(null)
  const problem: Failure | null = code ? failure : { info: NO_CODE }
  useTitle(problem ? null : 'Connecting OpenRouter · QA Ninja')

  useEffect(() => {
    if (!code) return
    let active = true
    complete(code).then(
      async (connection) => {
        if (!active) return
        await queryClient.invalidateQueries({ queryKey: ['execute'] })
        toast('OpenRouter connected', connection.label || 'OpenRouter')
        await navigate({
          to: '/execute',
          search: { tab: 'agents' },
          replace: true,
        })
      },
      (error: unknown) => {
        if (!active) return
        if (error instanceof ApiError) {
          // A 401 has already sent the visitor to sign in.
          if (error.status !== 401)
            setFailure({ info: failed(error.message), status: error.status })
        } else setFailure({ info: failed(errorMessage(error)) })
      }
    )
    return () => {
      active = false
    }
  }, [code, navigate, queryClient, toast])

  if (problem)
    return (
      <Page>
        <ErrorView info={problem.info} status={problem.status} />
      </Page>
    )
  return (
    <Page busy>
      <p className='lede'>Connecting OpenRouter…</p>
    </Page>
  )
}
