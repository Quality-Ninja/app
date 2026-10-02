import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api, errorMessage } from '@/lib/api'
import { currentSubject } from '@/lib/auth'
import { extensionProblem, runRefusal } from '@/lib/execute'
import {
  hasConsent,
  pingExtension,
  rememberConsent,
  startOnExtension,
} from '@/lib/extension'
import type { StartRunBody, StartRunResponse } from '@/lib/types'
import { ActionButton } from '@/components/ActionButton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PlayIcon } from '@/components/icons'

// "Run on this computer": check the extension is here and signed in to this account, ask for consent on this
// browser's first run, queue the run, hand it to the extension, and open the run's page, which follows it. A run the
// extension refuses is cancelled, so it doesn't wait in the queue. `prepare` returns the run to start (and may save
// the test's settings first); its errors are shown here.
export function RunButton({
  prepare,
  label = 'Run on this computer',
  className = 'primary',
}: {
  prepare: () => Promise<StartRunBody>
  label?: string
  className?: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [problem, setProblem] = useState<string | null>(null)
  const consent = useConsent()

  const run = async () => {
    setProblem(null)
    try {
      const [extension, subject] = await Promise.all([
        pingExtension(),
        currentSubject(),
      ])
      queryClient.setQueryData(['extension'], extension)
      const blocked = extensionProblem(extension, subject)
      if (blocked || !subject) {
        setProblem(blocked ?? 'Sign in again to run tests.')
        return
      }
      if (!hasConsent()) {
        if (!(await consent.ask())) return
        rememberConsent()
      }
      const body = await prepare()
      const { run } = await api<StartRunResponse>('/execute/runs', {
        method: 'POST',
        body,
      })
      void queryClient.invalidateQueries({ queryKey: ['execute'] })
      const answer = await startOnExtension(run.id, subject)
      // No answer in time: the extension may still be starting it, and the run's page shows how it goes.
      const refused = answer === 'timeout' ? null : runRefusal(answer)
      if (refused) {
        await api(`/execute/runs/${run.id}/cancel`, { method: 'POST' }).catch(
          () => undefined
        )
        void queryClient.invalidateQueries({ queryKey: ['execute'] })
        setProblem(refused)
        return
      }
      await navigate({ to: '/execute/runs/$id', params: { id: run.id } })
    } catch (error) {
      setProblem(errorMessage(error))
    }
  }

  return (
    <>
      <ActionButton className={className} data-run='' onAction={run}>
        <PlayIcon />
        {label}
      </ActionButton>
      {problem ? (
        <p className='notice error run-problem' role='alert'>
          {problem}
        </p>
      ) : null}
      {consent.dialog}
    </>
  )
}

// Asked once per browser, before the first run: what the run does, and where its screenshots and page text go.
function useConsent() {
  const [answer, setAnswer] = useState<((allowed: boolean) => void) | null>(
    null
  )
  const ask = useCallback(
    () => new Promise<boolean>((resolve) => setAnswer(() => resolve)),
    []
  )
  const dialog = (
    <ConfirmDialog
      open={answer !== null}
      title='Let QA Ninja run tests in Chrome?'
      confirmLabel='Allow and run'
      onAnswer={(allowed) => {
        answer?.(allowed)
        setAnswer(null)
      }}
    >
      <ul className='consent-points'>
        <li>
          QA Ninja opens a new Chrome window and controls it: it clicks, types,
          and moves between pages for the test.
        </li>
        <li>
          Screenshots and page text from that window go to the agent you chose
          and its provider.
        </li>
        <li>
          Use staging sites and test accounts. The window shares this Chrome
          profile, and with it your sign-ins.
        </li>
      </ul>
      <p className='meta'>
        You can stop a run or take over in its window. This browser remembers
        your answer.
      </p>
    </ConfirmDialog>
  )
  return { ask, dialog }
}
