import { api } from '@/lib/api'
import type { BillingInterval, CheckoutBody, UrlResponse } from '@/lib/types'
import { PLANS, type Plan } from '@/lib/views'
import { ActionButton } from '@/components/ActionButton'

// The paid plans. With `subscribe`, each offers monthly and yearly checkout (Stripe returns to /account).
export function PlanCards({ subscribe = false }: { subscribe?: boolean }) {
  return (
    <div className='plans'>
      {PLANS.map((plan) => {
        const id = `plan-${plan.code.toLowerCase()}`
        return (
          <section key={plan.code} className='plan' aria-labelledby={id}>
            <h3 id={id}>{plan.name}</h3>
            <p className='price'>
              {plan.monthly} <span className='meta'>per month</span>
            </p>
            <ul className='features'>
              <li>Unlimited XPath inspections</li>
              <li>Workflow recording in the extension</li>
              <li>
                Playwright, Selenium, Cypress, and Robot Framework scripts with
                a PDF report
              </li>
              <li>Remembered save folder</li>
              <li>{plan.storage}</li>
            </ul>
            {subscribe ? (
              <div className='row'>
                <CheckoutButton plan={plan} interval='monthly' />
                <CheckoutButton plan={plan} interval='yearly' />
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function CheckoutButton({
  plan,
  interval,
}: {
  plan: Plan
  interval: BillingInterval
}) {
  const price =
    interval === 'monthly'
      ? `${plan.monthly} per month`
      : `${plan.yearly} per year`
  return (
    <ActionButton
      data-plan={plan.code}
      data-interval={interval}
      onAction={async () => {
        const body: CheckoutBody = { plan: plan.code, interval }
        const { url } = await api<UrlResponse>('/billing/checkout', {
          method: 'POST',
          body,
        })
        location.href = url
        return 'leaving'
      }}
    >
      {price}
      <span className='sr-only'>, {plan.name}</span>
    </ActionButton>
  )
}

// Stripe's billing portal: change plan, update payment details, or cancel.
export function PortalButton({
  className,
  children,
}: {
  className: string
  children: string
}) {
  return (
    <ActionButton
      className={className}
      data-portal=''
      onAction={async () => {
        location.href = (
          await api<UrlResponse>('/billing/portal', { method: 'POST' })
        ).url
        return 'leaving'
      }}
    >
      {children}
    </ActionButton>
  )
}
