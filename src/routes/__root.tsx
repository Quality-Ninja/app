import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { useFocusOnNavigate } from '@/hooks/useUserShell'
import { ErrorView } from '@/components/ErrorView'
import { NoticeProvider } from '@/components/Notice'
import { Page } from '@/components/Page'
import { ToastProvider } from '@/components/Toast'
import { UserShell } from '@/components/UserShell'
import { NotFound } from '@/screens/compliance/NotFound'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    component: Root,
    // Any other address: Render and serve.js answer with 404.html (this app) and a 404 status.
    notFoundComponent: () => (
      <UserShell>
        <NotFound />
      </UserShell>
    ),
    errorComponent: ({ error }) => (
      <UserShell>
        <Page>
          <ErrorView
            info={{
              title: 'Something went wrong',
              message: error instanceof Error ? error.message : String(error),
              action: { label: 'Go to recordings', href: '/dashboard' },
            }}
          />
        </Page>
      </UserShell>
    ),
  }
)

function Root() {
  useFocusOnNavigate()
  return (
    <NoticeProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </NoticeProvider>
  )
}
