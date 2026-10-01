import { type ReactNode, useCallback, useRef, useState } from 'react'
import { ToastContext } from '@/hooks/useToast'
import { CheckIcon } from './icons'

type Item = { id: number; title: string; detail: string; leaving: boolean }

// Toasts confirm a finished action and leave on their own: after 2.4s, or 1.2s after the pointer leaves them; a click
// dismisses at once. Problems go to the page's notice instead.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<Item | null>(null)
  const timer = useRef(0)
  const count = useRef(0)

  const dismiss = useCallback((delay = 0) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setItem((current) => current && { ...current, leaving: true })
      timer.current = window.setTimeout(() => setItem(null), 160)
    }, delay)
  }, [])

  const toast = useCallback(
    (title: string, detail = '') => {
      count.current += 1
      setItem({ id: count.current, title, detail, leaving: false })
      dismiss(2400)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className='toast-region'
        role='status'
        aria-live='polite'
        aria-atomic='true'
        onPointerEnter={() => window.clearTimeout(timer.current)}
        onPointerLeave={() => {
          if (item) dismiss(1200)
        }}
        onClick={() => dismiss()}
      >
        {item ? (
          <div
            key={item.id}
            className='toast'
            data-state={item.leaving ? 'leaving' : undefined}
          >
            <CheckIcon />
            <div className='toast-body'>
              <strong className='toast-title'>{item.title}</strong>
              <code className='toast-detail' aria-hidden='true'>
                {item.detail}
              </code>
            </div>
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}
