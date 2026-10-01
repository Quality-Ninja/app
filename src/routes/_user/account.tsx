import { createFileRoute } from '@tanstack/react-router'
import { Account } from '@/screens/user/Account'

// Stripe returns to /account?checkout=success after checkout, and to /account from the billing portal.
type SearchParams = { checkout?: string }

export const Route = createFileRoute('/_user/account')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    checkout: typeof search.checkout === 'string' ? search.checkout : undefined,
  }),
  component: AccountRoute,
})

function AccountRoute() {
  const { checkout } = Route.useSearch()
  return <Account checkout={checkout === 'success'} />
}
