import { useQuery } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import {
  EPISODE_KINDS,
  EPISODE_STATUSES,
  callText,
  formatCost,
  isActive,
} from '@/lib/execute'
import type { RunDetail, TranscriptEntry, TranscriptEpisode } from '@/lib/types'
import { Screenshot } from '@/components/Screenshot'

// What the agent read, thought, and did, one collapsible episode per task (the latest open). Tool calls are compact
// text; screenshots it saw load as blobs. Everything is shown as text: page content in it is untrusted.
export function Transcript({ run }: { run: RunDetail }) {
  const transcript = useQuery({
    queryKey: ['execute', 'transcript', run.id],
    queryFn: () =>
      api<TranscriptEpisode[]>(`/execute/runs/${run.id}/transcript`),
    refetchInterval: isActive(run.status) ? 3000 : false,
  })
  const episodes = transcript.data
  return (
    <section aria-labelledby='transcript-title'>
      <h2 id='transcript-title'>Agent transcript</h2>
      {transcript.error ? (
        <p className='notice error'>{errorMessage(transcript.error)}</p>
      ) : !episodes ? (
        <p className='meta' aria-busy='true'>
          Loading the transcript…
        </p>
      ) : !episodes.length ? (
        <p className='meta'>
          {run.brain === 'none'
            ? 'Replay-only runs have no agent.'
            : run.brain === 'mcp'
              ? 'A coding agent drove this run; its conversation stays with it.'
              : isActive(run.status)
                ? "The agent hasn't been needed so far."
                : "The agent wasn't needed in this run."}
        </p>
      ) : (
        <div className='episodes'>
          {episodes.map((episode, index) => (
            <Episode
              key={episode.id}
              runId={run.id}
              episode={episode}
              open={index === episodes.length - 1}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Episode({
  runId,
  episode,
  open,
}: {
  runId: string
  episode: TranscriptEpisode
  open: boolean
}) {
  const task = EPISODE_KINDS[episode.kind] ?? episode.kind
  // Results name the call they answer; screenshots are described by it.
  const calls = new Map<string, string>()
  for (const entry of episode.entries)
    if (entry.type === 'assistant')
      for (const call of entry.calls)
        if (call.id && call.name) calls.set(call.id, call.name)
  return (
    <details className='episode' open={open} data-episode={episode.id}>
      <summary>
        <span className='episode-title'>
          {task}
          {episode.step_index === null
            ? ''
            : `, step ${episode.step_index + 1}`}
        </span>
        <span className='meta'>
          {[
            EPISODE_STATUSES[episode.status] ?? episode.status,
            episode.model,
            formatCost(episode.cost_usd),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </summary>
      {episode.summary ? (
        <p className='episode-summary'>{episode.summary}</p>
      ) : null}
      <ol className='transcript' role='list'>
        {episode.entries.map((entry, index) => (
          <Entry
            key={index}
            runId={runId}
            entry={entry}
            call={
              entry.type === 'result' && entry.tool_use_id
                ? calls.get(entry.tool_use_id)
                : undefined
            }
          />
        ))}
      </ol>
    </details>
  )
}

function Entry({
  runId,
  entry,
  call,
}: {
  runId: string
  entry: TranscriptEntry
  call?: string
}) {
  switch (entry.type) {
    case 'brief':
      return (
        <li className='entry' data-entry='brief'>
          <details>
            <summary>Brief from QA Ninja</summary>
            <pre>{entry.text}</pre>
          </details>
        </li>
      )
    case 'note':
      return (
        <li className='entry' data-entry='note'>
          <p className='entry-label'>QA Ninja</p>
          <pre>{entry.text}</pre>
        </li>
      )
    case 'nudge':
      return (
        <li className='entry' data-entry='nudge'>
          <p className='entry-label'>QA Ninja nudged the agent</p>
          <p className='meta'>{entry.text}</p>
        </li>
      )
    case 'assistant':
      return (
        <li className='entry' data-entry='assistant'>
          <p className='entry-label'>
            Agent{entry.fallback ? ' (fallback model)' : ''}
          </p>
          {entry.notes ? <p className='entry-notes'>{entry.notes}</p> : null}
          {entry.calls.length ? (
            <ul className='calls' role='list'>
              {entry.calls.map((item, index) => (
                <li key={item.id ?? index}>
                  <code>{callText(item)}</code>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      )
    case 'result':
      return (
        <li
          className='entry'
          data-entry='result'
          data-error={entry.error || undefined}
        >
          <p className='entry-label'>
            {entry.error ? 'Error' : 'Result'}
            {call ? ` of ${call}` : ''}
          </p>
          {entry.text ? <pre>{entry.text}</pre> : null}
          {entry.images.length ? (
            <div className='entry-shots'>
              {entry.images.map((image) => (
                <Screenshot
                  key={image}
                  path={`/execute/runs/${runId}/artifacts/${image}`}
                  alt={`Screenshot the agent saw${call ? ` after ${call}` : ''}`}
                />
              ))}
            </div>
          ) : null}
        </li>
      )
  }
}
