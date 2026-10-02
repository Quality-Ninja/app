import { useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '@/lib/api'
import { config } from '@/lib/config'
import { PROVIDERS, mcpSnippets, providerName, unixIso } from '@/lib/execute'
import { saveOpenRouterState } from '@/lib/extension'
import type {
  AddKeyBody,
  AgentConnection,
  Capabilities,
  KeyProvider,
  NewConnection,
  OAuthStart,
} from '@/lib/types'
import { useToast } from '@/hooks/useToast'
import { ActionButton } from '@/components/ActionButton'
import { CopyButton } from '@/components/CopyButton'
import { QueryError } from '@/components/ErrorView'
import { LocalTime } from '@/components/LocalTime'
import { UsageRail } from '@/components/UsageRail'

const KEY_PROVIDERS: KeyProvider[] = ['anthropic', 'openai', 'google']

// The reset is midnight UTC on the 1st, so the date is read in UTC.
const resetDay = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

// Agents: log in to your favorite agent. The QA Ninja Agent comes with the plan; the customer's own API key, an
// OpenRouter login, or a coding agent over MCP run tests without using its included runs.
export function AgentsTab({ caps }: { caps: Capabilities }) {
  const connections = useQuery({
    queryKey: ['execute', 'connections'],
    queryFn: () => api<AgentConnection[]>('/execute/connections'),
  })
  if (connections.error) return <QueryError error={connections.error} />
  if (!connections.data) return <div aria-busy='true' />

  return (
    <div className='agents'>
      <p className='hint'>
        Choose who runs your tests: the QA Ninja Agent, your own model account,
        or the coding agent you already use.
      </p>
      <section aria-labelledby='connections-title'>
        <h2 id='connections-title'>Your agents</h2>
        <ul className='connections' role='list'>
          <ManagedAgent caps={caps} />
          {connections.data.map((connection) => (
            <ConnectionItem key={connection.id} connection={connection} />
          ))}
        </ul>
      </section>
      <section aria-labelledby='connect-title'>
        <h2 id='connect-title'>Connect your own agent</h2>
        <div className='cards'>
          <AddKeyCard />
          <OpenRouterCard />
          <section className='card' aria-labelledby='chatgpt-title'>
            <div className='card-head'>
              <h3 id='chatgpt-title'>ChatGPT</h3>
              <span className='badge'>Coming soon</span>
            </div>
            <p className='hint'>Run tests with your ChatGPT plan.</p>
            <button type='button' disabled>
              Sign in with ChatGPT
            </button>
          </section>
        </div>
      </section>
      <CodingAgents remote={caps.execute_remote_mcp} />
    </div>
  )
}

// The QA Ninja Agent comes with the plan: its included runs this month, metered like dashboard recordings.
function ManagedAgent({ caps }: { caps: Capabilities }) {
  const used = caps.execute_managed_used
  const limit = caps.execute_managed_limit
  return (
    <li className='connection' data-connection='managed'>
      <div className='connection-main'>
        <h3 className='connection-name'>QA Ninja Agent</h3>
        <p className='meta'>Our own agent, with nothing to set up.</p>
        {caps.execute_managed_available ? null : (
          <p className='meta'>
            Not available right now. Connect your own agent to run assisted and
            agent tests.
          </p>
        )}
        {limit > 0 ? (
          <div className='usage' data-managed-usage=''>
            <UsageRail used={used} total={limit} />
            <p className='meta'>
              {used} of {limit} included runs used this month. Resets{' '}
              {resetDay.format(new Date(caps.execute_managed_resets_at * 1000))}
              .
            </p>
          </div>
        ) : null}
      </div>
      <span className='badge'>Included</span>
    </li>
  )
}

// An API key for Anthropic, OpenAI, or Google. The API checks it with the provider and lists its models; the key is
// never shown again, only its last four characters.
function AddKeyCard() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const id = useId()
  const [provider, setProvider] = useState<KeyProvider>('anthropic')
  const [key, setKey] = useState('')
  const [label, setLabel] = useState('')
  const [added, setAdded] = useState<NewConnection | null>(null)
  const [model, setModel] = useState('')

  const add = async () => {
    const apiKey = key.trim()
    if (apiKey.length < 16) throw new Error('Paste the whole API key.')
    const body: AddKeyBody = {
      provider,
      api_key: apiKey,
      ...(label.trim() ? { label: label.trim() } : {}),
    }
    const created = await api<NewConnection>('/execute/connections', {
      method: 'POST',
      body,
    })
    setKey('')
    setLabel('')
    setAdded(created)
    setModel(created.model || created.models[0] || '')
    await queryClient.invalidateQueries({
      queryKey: ['execute', 'connections'],
    })
    toast('Key added', `${providerName(created.provider)} ••••${created.last4}`)
  }

  const saveModel = async () => {
    if (!added || !model) return
    await api<AgentConnection>(`/execute/connections/${added.id}`, {
      method: 'PATCH',
      body: { model },
    })
    await queryClient.invalidateQueries({ queryKey: ['execute'] })
    toast('Model saved', model)
    setAdded(null)
  }

  return (
    <section className='card' aria-labelledby={`${id}-title`}>
      <div className='card-head'>
        <h3 id={`${id}-title`}>Your API key</h3>
      </div>
      {added ? (
        <div className='fields' data-new-connection={added.id}>
          <p className='hint'>
            {providerName(added.provider)} key{' '}
            <span className='code'>••••{added.last4}</span> added. Choose the
            model it runs tests with.
          </p>
          {added.models.length ? (
            <div className='field'>
              <label htmlFor={`${id}-model`}>Model</label>
              <select
                id={`${id}-model`}
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                {added.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className='meta'>This key didn't list any models.</p>
          )}
          <div className='row'>
            <ActionButton onAction={saveModel} disabled={!model}>
              Save model
            </ActionButton>
            <button
              type='button'
              className='quiet'
              onClick={() => setAdded(null)}
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className='fields'
          noValidate
          onSubmit={(event) => event.preventDefault()}
        >
          <p className='hint'>
            Anthropic, OpenAI, or Google. Runs bill to your account with them.
          </p>
          <div className='field'>
            <label htmlFor={`${id}-provider`}>Provider</label>
            <select
              id={`${id}-provider`}
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as KeyProvider)
              }
            >
              {KEY_PROVIDERS.map((name) => (
                <option key={name} value={name}>
                  {PROVIDERS[name]}
                </option>
              ))}
            </select>
          </div>
          <div className='field'>
            <label htmlFor={`${id}-key`}>API key</label>
            <input
              id={`${id}-key`}
              type='password'
              autoComplete='off'
              spellCheck={false}
              maxLength={300}
              value={key}
              aria-describedby={`${id}-key-hint`}
              onChange={(event) => setKey(event.target.value)}
            />
            <p id={`${id}-key-hint`} className='field-hint'>
              Stored encrypted and never shown again: you'll see its last four
              characters.
            </p>
          </div>
          <div className='field'>
            <label htmlFor={`${id}-label`}>Name (optional)</label>
            <input
              id={`${id}-label`}
              autoComplete='off'
              maxLength={80}
              placeholder={PROVIDERS[provider]}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className='row'>
            <ActionButton data-add-key='' onAction={add}>
              Add key
            </ActionButton>
          </div>
        </form>
      )}
    </section>
  )
}

// OpenRouter signs the visitor in on its own site (PKCE), then sends them to /execute/connect/openrouter.
function OpenRouterCard() {
  const connect = async () => {
    const { url, state } = await api<OAuthStart>(
      '/execute/connections/openrouter/start',
      { method: 'POST' }
    )
    if (new URL(url).origin !== 'https://openrouter.ai')
      throw new Error('OpenRouter sign-in is not set up correctly.')
    if (!saveOpenRouterState(state))
      throw new Error(
        'This browser blocked site storage, which signing in with OpenRouter needs. Allow it, then try again.'
      )
    window.location.assign(url)
    return 'leaving' as const
  }
  return (
    <section className='card' aria-labelledby='openrouter-title'>
      <div className='card-head'>
        <h3 id='openrouter-title'>OpenRouter</h3>
      </div>
      <p className='hint'>
        Sign in with OpenRouter to use its models, billed to your OpenRouter
        account.
      </p>
      <ActionButton data-openrouter='' onAction={connect}>
        Connect OpenRouter
      </ActionButton>
    </section>
  )
}

// One of the customer's agents: rename it, choose its model, or remove it.
function ConnectionItem({ connection }: { connection: AgentConnection }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [editing, setEditing] = useState<'label' | 'model' | null>(null)
  const name = connection.label || providerName(connection.provider)

  const remove = async () => {
    await api(`/execute/connections/${connection.id}`, { method: 'DELETE' })
    await queryClient.invalidateQueries({ queryKey: ['execute'] })
    toast('Agent removed', name)
  }

  return (
    <li className='connection' data-connection={connection.id}>
      <div className='connection-main'>
        <h3 className='connection-name'>{name}</h3>
        <p className='meta'>
          {providerName(connection.provider)} ·{' '}
          {connection.kind === 'oauth' ? (
            'signed in'
          ) : (
            <span className='code'>••••{connection.last4}</span>
          )}{' '}
          · {connection.model || 'no model chosen'}
        </p>
        <p className='meta'>
          Added <LocalTime value={unixIso(connection.created_at)} />
          {connection.last_used_at ? (
            <>
              {', last used '}
              <LocalTime value={unixIso(connection.last_used_at)} />
            </>
          ) : null}
        </p>
        {connection.status === 'invalid' ? (
          <p className='field-error'>
            This connection stopped working. Remove it and connect again.
          </p>
        ) : null}
      </div>
      <div className='connection-actions'>
        <button
          type='button'
          className='quiet'
          aria-expanded={editing === 'label'}
          onClick={() => setEditing(editing === 'label' ? null : 'label')}
        >
          Rename<span className='sr-only'> {name}</span>
        </button>
        <button
          type='button'
          className='quiet'
          aria-expanded={editing === 'model'}
          onClick={() => setEditing(editing === 'model' ? null : 'model')}
        >
          {connection.model ? 'Change model' : 'Choose a model'}
          <span className='sr-only'> for {name}</span>
        </button>
        <ActionButton
          className='quiet danger'
          confirm={`Remove ${name}? Runs can't use it after this.`}
          onAction={remove}
        >
          Remove<span className='sr-only'> {name}</span>
        </ActionButton>
      </div>
      {editing === 'label' ? (
        <RenameForm connection={connection} done={() => setEditing(null)} />
      ) : null}
      {editing === 'model' ? (
        <ModelForm connection={connection} done={() => setEditing(null)} />
      ) : null}
    </li>
  )
}

function RenameForm({
  connection,
  done,
}: {
  connection: AgentConnection
  done: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const id = useId()
  const [label, setLabel] = useState(connection.label)
  const save = async () => {
    if (!label.trim()) throw new Error('Give this agent a name.')
    const updated = await api<AgentConnection>(
      `/execute/connections/${connection.id}`,
      { method: 'PATCH', body: { label: label.trim() } }
    )
    await queryClient.invalidateQueries({ queryKey: ['execute'] })
    toast('Agent renamed', updated.label)
    done()
  }
  return (
    <form
      className='connection-edit'
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor={`${id}-label`}>Name</label>
      <div className='row'>
        <input
          id={`${id}-label`}
          autoComplete='off'
          maxLength={80}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <ActionButton onAction={save}>Save name</ActionButton>
        <button type='button' className='quiet' onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// The models a connection can use come from its provider, through the API, when this opens.
function ModelForm({
  connection,
  done,
}: {
  connection: AgentConnection
  done: () => void
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const id = useId()
  const models = useQuery({
    queryKey: ['execute', 'models', connection.id],
    queryFn: () =>
      api<{ models: string[] }>(`/execute/connections/${connection.id}/models`),
    staleTime: 5 * 60_000,
  })
  const [model, setModel] = useState(connection.model)
  const options = models.data?.models ?? []
  const chosen = model || options[0] || ''

  const save = async () => {
    if (!chosen) return
    await api<AgentConnection>(`/execute/connections/${connection.id}`, {
      method: 'PATCH',
      body: { model: chosen },
    })
    await queryClient.invalidateQueries({ queryKey: ['execute'] })
    toast('Model saved', chosen)
    done()
  }

  if (models.error)
    return (
      <p className='notice error connection-edit' role='alert'>
        {errorMessage(models.error)}
      </p>
    )
  if (!models.data)
    return (
      <p className='meta connection-edit' aria-busy='true'>
        Loading models…
      </p>
    )
  return (
    <form
      className='connection-edit'
      noValidate
      onSubmit={(event) => event.preventDefault()}
    >
      <label htmlFor={`${id}-model`}>Model</label>
      <div className='row'>
        <select
          id={`${id}-model`}
          value={chosen}
          onChange={(event) => setModel(event.target.value)}
        >
          {options.includes(chosen) || !chosen ? null : (
            <option value={chosen}>{chosen}</option>
          )}
          {options.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <ActionButton onAction={save} disabled={!chosen}>
          Save model
        </ActionButton>
        <button type='button' className='quiet' onClick={done}>
          Cancel
        </button>
      </div>
    </form>
  )
}

// Coding agents drive runs through QA Ninja's MCP server, with their own model: the local bridge (npx @qaninja/mcp)
// connects to the extension in this Chrome; the remote server, when it's on, manages tests and runs from anywhere.
function CodingAgents({ remote }: { remote: boolean }) {
  return (
    <section aria-labelledby='mcp-title'>
      <h2 id='mcp-title'>Coding agents (MCP)</h2>
      <p className='hint'>
        Let Claude Code, Codex, Cursor, or Claude Desktop run your tests. The QA
        Ninja MCP bridge drives this Chrome through the extension, and your
        coding agent does the thinking.
      </p>
      <ul className='snippets' role='list'>
        {mcpSnippets(config.apiBaseUrl, remote).map((snippet) => (
          <li key={snippet.id} className='snippet' data-snippet={snippet.id}>
            <h3>{snippet.title}</h3>
            <p className='meta'>{snippet.where}</p>
            <div className='well'>
              <code>{snippet.text}</code>
              <CopyButton
                text={snippet.text}
                label={`for ${snippet.title}`}
                what={snippet.text.startsWith('{') ? 'config' : 'command'}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className='notice'>
        Claude Pro/Max subscriptions can't be used by other apps; use an
        Anthropic API key, or connect Claude Code through MCP to use your plan.
      </p>
    </section>
  )
}
