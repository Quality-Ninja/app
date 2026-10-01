import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ready, watchIdentity } from '@/lib/auth'

// The pages under the header show one account's data: reload them if the account changes in another tab.
export function useIdentityWatch() {
  useEffect(() => {
    let active = true
    let stop: (() => void) | undefined
    ready.then(
      (clerk) => {
        if (active) stop = watchIdentity(clerk)
      },
      () => {}
    )
    return () => {
      active = false
      stop?.()
    }
  }, [])
}

// After moving to another page without a reload, focus goes where a page load would put a screen reader: the new
// page's main, once it has rendered.
export function useFocusOnNavigate() {
  const router = useRouter()
  useEffect(
    () =>
      router.subscribe('onRendered', ({ fromLocation, pathChanged }) => {
        if (fromLocation && pathChanged)
          document.getElementById('content')?.focus({ preventScroll: true })
      }),
    [router]
  )
}
