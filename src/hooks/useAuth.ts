import { useSyncExternalStore } from 'react'
import { authState, subscribeAuth } from '@/lib/auth'

// Who is signed in: loading until Clerk has loaded, unavailable if it can't (not configured, or blocked).
export function useAuth() {
  const state = useSyncExternalStore(subscribeAuth, authState)
  return {
    ...state,
    signedIn: state.status === 'ready' && state.userId !== null,
  }
}
