import type { ChangeEvent } from 'react'
import { ASSERTIONS, type SettingsForm, rowKey } from '@/lib/execute'
import type { AssertionType } from '@/lib/types'

export type ChangeForm = (
  recipe: (form: SettingsForm) => Partial<SettingsForm>
) => void

function replaceRow<T extends { key: number }>(
  rows: T[],
  key: number,
  changes: Partial<T>
): T[] {
  return rows.map((row) => (row.key === key ? { ...row, ...changes } : row))
}

const value = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
  event.target.value

// aria-describedby for a field: its hint, then its problem when it has one.
const describedBy = (id: string, error?: string) =>
  error ? `${id}-hint ${id}-error` : `${id}-hint`

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={`${id}-error`} className='field-error'>
      {error}
    </p>
  ) : null
}

// A test's settings, as plain fields. Secrets are names only: their values stay in the extension, on the computer
// that runs the test. `errors` is keyed like settingsErrors() in lib/execute.ts.
export function SettingsFields({
  form,
  change,
  errors,
  recordedOrigin,
}: {
  form: SettingsForm
  change: ChangeForm
  errors: Record<string, string>
  recordedOrigin: string
}) {
  return (
    <div className='fields'>
      <div className='field'>
        <label htmlFor='settings-goal'>Goal</label>
        <textarea
          id='settings-goal'
          rows={3}
          maxLength={2000}
          value={form.goal}
          aria-describedby='settings-goal-hint'
          onChange={(event) => {
            const goal = value(event)
            change(() => ({ goal }))
          }}
        />
        <p id='settings-goal-hint' className='field-hint'>
          What the test should achieve, in plain words. Agent runs work toward
          it.
        </p>
      </div>
      <div className='field'>
        <label htmlFor='settings-outcome'>Expected outcome</label>
        <textarea
          id='settings-outcome'
          rows={2}
          maxLength={2000}
          value={form.expected_outcome}
          aria-describedby='settings-outcome-hint'
          onChange={(event) => {
            const expected_outcome = value(event)
            change(() => ({ expected_outcome }))
          }}
        />
        <p id='settings-outcome-hint' className='field-hint'>
          How to tell it worked. Assisted and agent runs judge the result by it.
        </p>
      </div>
      <div className='field'>
        <label htmlFor='settings-base'>Base URL</label>
        <input
          id='settings-base'
          type='url'
          inputMode='url'
          autoComplete='off'
          spellCheck={false}
          maxLength={300}
          placeholder='https://staging.example.com'
          value={form.base_url}
          aria-invalid={errors.base_url ? true : undefined}
          aria-describedby={describedBy('settings-base', errors.base_url)}
          onChange={(event) => {
            const base_url = value(event)
            change(() => ({ base_url }))
          }}
        />
        <p id='settings-base-hint' className='field-hint'>
          Run against another copy of the site, such as staging. Leave it empty
          to use the recorded site{recordedOrigin ? `, ${recordedOrigin}` : ''}.
        </p>
        <FieldError id='settings-base' error={errors.base_url} />
      </div>
      <div className='field'>
        <label htmlFor='settings-origins'>Allowed origins</label>
        <textarea
          id='settings-origins'
          rows={3}
          spellCheck={false}
          value={form.allowed_origins}
          aria-invalid={errors.allowed_origins ? true : undefined}
          aria-describedby={describedBy(
            'settings-origins',
            errors.allowed_origins
          )}
          onChange={(event) => {
            const allowed_origins = value(event)
            change(() => ({ allowed_origins }))
          }}
        />
        <p id='settings-origins-hint' className='field-hint'>
          The only sites a run may open, one per line, like
          https://login.example.com.
        </p>
        <FieldError id='settings-origins' error={errors.allowed_origins} />
      </div>
      <InputRows form={form} change={change} errors={errors} />
      <SecretRows form={form} change={change} errors={errors} />
      <CheckRows form={form} change={change} errors={errors} />
    </div>
  )
}

type RowsProps = {
  form: SettingsForm
  change: ChangeForm
  errors: Record<string, string>
}

function InputRows({ form, change, errors }: RowsProps) {
  return (
    <fieldset
      className='field rows-field'
      aria-describedby='settings-inputs-hint'
    >
      <legend>Inputs</legend>
      <p id='settings-inputs-hint' className='field-hint'>
        Values the test types, by name, such as email. The recording's own
        inputs come first, with their recorded values. Put passwords and codes
        under Secrets.
      </p>
      {form.inputs.length ? (
        <ul className='rows' role='list'>
          {form.inputs.map((row, index) => {
            const id = `settings-input-${row.key}`
            const error = errors[`inputs.${row.key}`]
            const setValue = (event: ChangeEvent<HTMLInputElement>) => {
              const text = value(event)
              change((current) => ({
                inputs: replaceRow(current.inputs, row.key, { value: text }),
              }))
            }
            // The recording's steps type this input by name, so its name stays.
            if (row.recorded)
              return (
                <li key={row.key} className='row-item' data-input={row.name}>
                  <div className='row-controls'>
                    <label className='row-name' htmlFor={`${id}-value`}>
                      {row.label && row.label !== row.name ? (
                        <>
                          {row.label} <code>{row.name}</code>
                        </>
                      ) : (
                        <code>{row.name}</code>
                      )}
                    </label>
                    <input
                      id={`${id}-value`}
                      autoComplete='off'
                      maxLength={500}
                      value={row.value}
                      onChange={setValue}
                    />
                  </div>
                </li>
              )
            return (
              <li key={row.key} className='row-item'>
                <div className='row-controls'>
                  <input
                    className='code'
                    aria-label={`Input ${index + 1} name`}
                    placeholder='name'
                    autoComplete='off'
                    spellCheck={false}
                    maxLength={40}
                    value={row.name}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(event) => {
                      const name = value(event)
                      change((current) => ({
                        inputs: replaceRow(current.inputs, row.key, { name }),
                      }))
                    }}
                  />
                  <input
                    aria-label={`Input ${index + 1} value`}
                    placeholder='value'
                    autoComplete='off'
                    maxLength={500}
                    value={row.value}
                    onChange={setValue}
                  />
                  <button
                    type='button'
                    className='quiet compact'
                    onClick={() =>
                      change((current) => ({
                        inputs: current.inputs.filter(
                          (item) => item.key !== row.key
                        ),
                      }))
                    }
                  >
                    Remove<span className='sr-only'> input {index + 1}</span>
                  </button>
                </div>
                <FieldError id={id} error={error} />
              </li>
            )
          })}
        </ul>
      ) : null}
      <FieldError id='settings-inputs' error={errors.inputs} />
      <button
        type='button'
        className='quiet compact add-row'
        onClick={() =>
          change((current) => ({
            inputs: [...current.inputs, { key: rowKey(), name: '', value: '' }],
          }))
        }
      >
        Add an input
      </button>
    </fieldset>
  )
}

function SecretRows({ form, change, errors }: RowsProps) {
  return (
    <fieldset
      className='field rows-field'
      aria-describedby='settings-secrets-hint'
    >
      <legend>Secrets</legend>
      <p id='settings-secrets-hint' className='field-hint'>
        Name more passwords and codes the test types; the recording's own are
        already known. Their values never reach QA Ninja: you enter them in the
        extension, on the computer that runs the test.
      </p>
      {form.secrets.length ? (
        <ul className='rows' role='list'>
          {form.secrets.map((row, index) => {
            const id = `settings-secret-${row.key}`
            const error = errors[`secrets.${row.key}`]
            return (
              <li key={row.key} className='row-item'>
                <div className='row-controls'>
                  <input
                    className='code'
                    aria-label={`Secret ${index + 1} name`}
                    placeholder='password'
                    autoComplete='off'
                    spellCheck={false}
                    maxLength={40}
                    value={row.name}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(event) => {
                      const name = value(event)
                      change((current) => ({
                        secrets: replaceRow(current.secrets, row.key, { name }),
                      }))
                    }}
                  />
                  <input
                    aria-label={`Secret ${index + 1} label`}
                    placeholder='Label, like Password'
                    autoComplete='off'
                    maxLength={80}
                    value={row.label}
                    onChange={(event) => {
                      const label = value(event)
                      change((current) => ({
                        secrets: replaceRow(current.secrets, row.key, {
                          label,
                        }),
                      }))
                    }}
                  />
                  <button
                    type='button'
                    className='quiet compact'
                    onClick={() =>
                      change((current) => ({
                        secrets: current.secrets.filter(
                          (item) => item.key !== row.key
                        ),
                      }))
                    }
                  >
                    Remove<span className='sr-only'> secret {index + 1}</span>
                  </button>
                </div>
                <FieldError id={id} error={error} />
              </li>
            )
          })}
        </ul>
      ) : null}
      <FieldError id='settings-secrets' error={errors.secrets} />
      <button
        type='button'
        className='quiet compact add-row'
        onClick={() =>
          change((current) => ({
            secrets: [
              ...current.secrets,
              { key: rowKey(), name: '', label: '' },
            ],
          }))
        }
      >
        Add a secret
      </button>
    </fieldset>
  )
}

function CheckRows({ form, change, errors }: RowsProps) {
  return (
    <fieldset
      className='field rows-field'
      aria-describedby='settings-checks-hint'
    >
      <legend>Checks</legend>
      <p id='settings-checks-hint' className='field-hint'>
        What must be true when the run ends.
      </p>
      {form.assertions.length ? (
        <ul className='rows' role='list'>
          {form.assertions.map((row, index) => (
            <li key={row.key} className='row-item'>
              <div className='row-controls check-controls'>
                <select
                  aria-label={`Check ${index + 1}`}
                  value={row.type}
                  onChange={(event) => {
                    const type = event.target.value as AssertionType
                    change((current) => ({
                      assertions: replaceRow(current.assertions, row.key, {
                        type,
                      }),
                    }))
                  }}
                >
                  {Object.entries(ASSERTIONS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Check ${index + 1} text`}
                  placeholder='Thank you for your order'
                  autoComplete='off'
                  maxLength={300}
                  value={row.value}
                  onChange={(event) => {
                    const text = value(event)
                    change((current) => ({
                      assertions: replaceRow(current.assertions, row.key, {
                        value: text,
                      }),
                    }))
                  }}
                />
                <button
                  type='button'
                  className='quiet compact'
                  onClick={() =>
                    change((current) => ({
                      assertions: current.assertions.filter(
                        (item) => item.key !== row.key
                      ),
                    }))
                  }
                >
                  Remove<span className='sr-only'> check {index + 1}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError id='settings-checks' error={errors.assertions} />
      <button
        type='button'
        className='quiet compact add-row'
        onClick={() =>
          change((current) => ({
            assertions: [
              ...current.assertions,
              { key: rowKey(), type: 'text_visible', value: '' },
            ],
          }))
        }
      >
        Add a check
      </button>
    </fieldset>
  )
}
