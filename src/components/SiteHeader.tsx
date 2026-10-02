import { Link, useLocation } from '@tanstack/react-router'
import mark from '@/assets/mark-48.png'
import { signOut } from '@/lib/auth'
import { useAuth } from '@/hooks/useAuth'
import { ActionButton } from './ActionButton'

export function SiteHeader() {
  const { signedIn } = useAuth()
  const pathname = useLocation({ select: (location) => location.pathname })
  // A recording belongs to Recordings, and a run or an agent sign-in to Execute, so those tabs stay marked there (the
  // link itself marks the current page).
  const inRecording = pathname.startsWith('/workflow/') ? 'true' : undefined
  const inExecute = pathname.startsWith('/execute/') ? 'true' : undefined
  return (
    <header className='site-header'>
      <div className='site-header-inner'>
        <Link className='brand' to='/'>
          <img src={mark} alt='' width='28' height='28' />
          QA Ninja
        </Link>
        <nav className='tabs' aria-label='Main'>
          <Link to='/dashboard' data-tab='dashboard' aria-current={inRecording}>
            Recordings
          </Link>
          <Link
            to='/execute'
            data-tab='execute'
            aria-current={inExecute}
            activeOptions={{ exact: true, includeSearch: false }}
          >
            Execute
          </Link>
          <Link to='/account' data-tab='account'>
            Account
          </Link>
        </nav>
        <ActionButton
          className='quiet signout'
          data-logout=''
          hidden={!signedIn}
          onAction={async () => {
            await signOut()
            return 'leaving'
          }}
        >
          Sign out
        </ActionButton>
      </div>
    </header>
  )
}
