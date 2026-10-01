import { createContext, useContext } from 'react'

// Confirms a finished action, such as a copy: a title and, in code type, what it applied to.
export type Toast = (title: string, detail?: string) => void

export const ToastContext = createContext<Toast>(() => {})

export const useToast = () => useContext(ToastContext)
