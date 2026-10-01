import type { ReactNode } from 'react'
import { Notice } from './Notice'

// A page's <main>: the skip link's target, and where focus lands after moving between pages. It is busy while the
// page's data loads. Screens place their sections directly inside it; the CSS spaces main's children.
export function Page({
  busy = false,
  children,
}: {
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <main
      id='content'
      className='page'
      tabIndex={-1}
      aria-busy={busy || undefined}
    >
      <Notice />
      {children}
    </main>
  )
}
