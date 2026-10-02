import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { isActive } from '@/lib/execute'
import { stringifySearch } from '@/lib/search'
import type { Capabilities, RunsPage } from '@/lib/types'
import { EmptyState } from '@/components/EmptyState'
import { QueryError } from '@/components/ErrorView'
import { ExecuteGate } from './ExecuteGate'
import { RunRow } from './RunRow'

// Every run, newest first, from the dashboard, the extension, and coding agents; older pages load on request. The
// list follows runs that are still going.
export function RunsTab({ caps }: { caps: Capabilities }) {
  const runs = useInfiniteQuery({
    queryKey: ['execute', 'runs'],
    queryFn: ({ pageParam }) =>
      api<RunsPage>(
        '/execute/runs' + stringifySearch({ limit: 25, before: pageParam })
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.next_cursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages[0]?.data.some((run) => isActive(run.status))
        ? 3000
        : false,
  })
  if (runs.error) return <QueryError error={runs.error} />
  if (!runs.data) return <div aria-busy='true' />

  const list = runs.data.pages.flatMap((page) => page.data)
  if (!list.length)
    return caps.execute ? (
      <EmptyState title='No runs yet'>
        <p>
          Choose a test in Run a test and run it on this computer. Runs started
          from the extension or a coding agent appear here too.
        </p>
      </EmptyState>
    ) : (
      <ExecuteGate caps={caps} />
    )
  return (
    <>
      {!caps.recording ? (
        <p className='notice'>
          Your plan has ended. You can still look through and delete these runs.
        </p>
      ) : null}
      <ul className='run-list' role='list'>
        {list.map((run) => (
          <RunRow key={run.id} run={run} />
        ))}
      </ul>
      {runs.hasNextPage ? (
        <button
          type='button'
          className='more'
          disabled={runs.isFetchingNextPage}
          aria-busy={runs.isFetchingNextPage || undefined}
          onClick={() => void runs.fetchNextPage()}
        >
          Show older runs
        </button>
      ) : null}
    </>
  )
}
