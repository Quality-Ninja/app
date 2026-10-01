import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Capabilities } from '@/lib/types'
import { planName } from '@/lib/views'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { QueryError } from '@/components/ErrorView'
import { Page } from '@/components/Page'
import { PlanCards, PortalButton } from './PlanCards'

// Plan and billing. Signed-out visitors (or any visitor while sign-in is unavailable) see the plans and a way in.
export function Account({ checkout }: { checkout: boolean }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <Page busy />
  return auth.signedIn ? (
    <SignedInAccount checkout={checkout} />
  ) : (
    <SignedOutAccount />
  )
}

function SignedOutAccount() {
  useTitle('Account · QA Ninja')
  return (
    <Page>
      <div className='auth'>
        <h1>Sign in</h1>
        <p className='hint'>
          Sign in to see your recordings and manage your plan. XPath Finder in
          the extension is free for 50 inspections a day and needs no account.
        </p>
        <div className='row'>
          <a className='button primary' href='/sign-in?next=/account'>
            Continue with email or Google
          </a>
          <a className='button' href='/sign-in?mode=signup&next=/account'>
            Create an account
          </a>
        </div>
      </div>
      <section aria-labelledby='plans-title'>
        <h2 id='plans-title'>Plans</h2>
        <p className='hint'>Sign in or create an account to subscribe.</p>
        <PlanCards />
      </section>
    </Page>
  )
}

function SignedInAccount({ checkout }: { checkout: boolean }) {
  const { data, error } = useQuery({
    queryKey: ['account'],
    queryFn: () => api<Capabilities>('/me/account'),
    // Back from Stripe checkout, the payment webhook may still be on its way: look again for a minute.
    refetchInterval: (query) =>
      checkout &&
      !query.state.data?.recording &&
      query.state.dataUpdateCount < 20
        ? 3000
        : false,
  })
  useTitle(error ? null : 'Account · QA Ninja')
  if (error)
    return (
      <Page>
        <QueryError error={error} />
      </Page>
    )
  if (!data) return <Page busy />
  return (
    <Page>
      <h1>Account</h1>
      <dl className='facts'>
        <dt>Email</dt>
        <dd>{data.email}</dd>
        <dt>Plan</dt>
        <dd>{planName(data.plan)}</dd>
      </dl>
      {checkout ? (
        <p className='notice'>
          {data.recording
            ? 'Your plan is active. Open Record in the extension to start recording.'
            : 'Activating your plan. This page updates once payment is confirmed, and recording then unlocks in the extension.'}
        </p>
      ) : null}
      {data.recording ? (
        <>
          <p className='hint'>
            Change your plan, update payment details, or cancel in the billing
            portal.
          </p>
          <PortalButton className='primary'>Manage subscription</PortalButton>
        </>
      ) : checkout ? null : (
        <>
          <section aria-labelledby='plans-title'>
            <h2 id='plans-title'>Choose a plan</h2>
            <PlanCards subscribe />
          </section>
          <p>
            <PortalButton className='quiet'>
              Manage a previous subscription
            </PortalButton>
          </p>
        </>
      )}
      <p className='meta'>
        When your paid access ends, you can still download or delete your saved
        recordings.
      </p>
    </Page>
  )
}
