import { NOT_FOUND } from '@/lib/views'
import { ErrorView } from '@/components/ErrorView'
import { Page } from '@/components/Page'

// Any address that isn't a page. Render and serve.js answer it with 404.html and a real 404 status.
export function NotFound() {
  return (
    <Page>
      <ErrorView info={NOT_FOUND} status={404} />
    </Page>
  )
}
