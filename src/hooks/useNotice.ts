import { createContext, useContext } from 'react'

// The page's notice (#message): problems and states that need attention. Confirmations are toasts instead.
export type NoticeState = { text: string; error: boolean; at: string } | null

export type NoticeApi = {
  notice: NoticeState
  say(text: string, error?: boolean): void
}

export const NoticeContext = createContext<NoticeApi>({
  notice: null,
  say() {},
})

export const useNotice = () => useContext(NoticeContext)
