import { createFileRoute } from '@tanstack/react-router'
import { RequireSignIn } from '@/components/RequireSignIn'
import { OpenRouterCallback } from '@/screens/user/execute/OpenRouterCallback'

// OpenRouter sends the visitor back here with ?code= once they approve QA Ninja (Agents > Connect OpenRouter).
type SearchParams = { code?: string }

export const Route = createFileRoute('/_user/execute/connect/openrouter')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    code: typeof search.code === 'string' ? search.code : undefined,
  }),
  component: OpenRouterRoute,
})

function OpenRouterRoute() {
  const { code } = Route.useSearch()
  // The code can't cross sign-in (views.ts safeNext), so a signed-out visitor starts again from Agents.
  return (
    <RequireSignIn next='/execute?tab=agents'>
      <OpenRouterCallback code={code} />
    </RequireSignIn>
  )
}
