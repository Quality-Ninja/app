import type { ReactNode } from 'react'
import { useIdentityWatch } from '@/hooks/useUserShell'
import { SiteHeader } from './SiteHeader'

// The frame of every page under the header: Recordings, Execute, Account, a recording, a run, and "Page not found".
export function UserShell({ children }: { children: ReactNode }) {
  useIdentityWatch()
  return (
    <>
      <a className='skip-link' href='#content'>
        Skip to content
      </a>
      <SiteHeader />
      {children}
    </>
  )
}
