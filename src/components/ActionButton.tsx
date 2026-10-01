import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useState,
} from 'react'
import { errorMessage } from '@/lib/api'
import { useNotice } from '@/hooks/useNotice'

type Props = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'type'
> & {
  // Resolve to 'leaving' when the action navigates away (Stripe, sign-out): the button stays busy until the page goes.
  onAction: () => Promise<'leaving' | void>
  // Asked before the action runs, for actions that can't be undone.
  confirm?: string
  children: ReactNode
}

// A button whose action talks to the API: busy while it runs, its error in the page's notice, ready again after.
export function ActionButton({
  onAction,
  confirm,
  disabled,
  children,
  ...rest
}: Props) {
  const [busy, setBusy] = useState(false)
  const { say } = useNotice()

  // Coming back from Stripe restores the page from the back/forward cache with the button still busy.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  const run = async () => {
    if (confirm && !window.confirm(confirm)) return
    setBusy(true)
    try {
      if ((await onAction()) !== 'leaving') setBusy(false)
    } catch (error) {
      say(errorMessage(error), true)
      setBusy(false)
    }
  }

  return (
    <button
      type='button'
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={run}
    >
      {children}
    </button>
  )
}
