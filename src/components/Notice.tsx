import { type ReactNode, useCallback, useMemo, useState } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { NoticeContext, type NoticeState, useNotice } from '@/hooks/useNotice'

const here = (location: { pathname: string; searchStr: string }) =>
  location.pathname + location.searchStr

export function NoticeProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [notice, setNotice] = useState<NoticeState>(null)
  // A notice belongs to the page it was said on, and stays there until the next one.
  const say = useCallback(
    (text: string, error = false) =>
      setNotice({ text, error, at: here(router.state.location) }),
    [router]
  )
  const value = useMemo(() => ({ notice, say }), [notice, say])
  return (
    <NoticeContext.Provider value={value}>{children}</NoticeContext.Provider>
  )
}

// #message: a persistent live region that takes no space while empty.
export function Notice() {
  const { notice } = useNotice()
  const at = useLocation({ select: here })
  const shown = notice?.at === at ? notice : null
  return (
    <p
      id='message'
      className={shown?.error ? 'notice error' : 'notice'}
      role='status'
      aria-live='polite'
    >
      {shown?.text}
    </p>
  )
}
