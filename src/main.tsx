import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ApiError } from '@/lib/api'
import { parseSearch, stringifySearch } from '@/lib/search'
import { routeTree } from './routeTree.gen'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      // The API's errors are answers (a plan is required, a recording is gone); only a failed request gets a retry.
      retry: (failures, error) => !(error instanceof ApiError) && failures < 1,
    },
  },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  parseSearch,
  stringifySearch,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('App root element was not found')

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
