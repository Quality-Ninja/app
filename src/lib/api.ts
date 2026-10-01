// Calls the QA Ninja API with the signed-in user's Clerk token. The API ignores cookies, so files and screenshots are
// fetched here too and handed to the page as blobs; tokens never appear in a URL.
import { signInUrl, token } from './auth'
import { config } from './config'
import { filenameFrom } from './content-disposition'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown }

async function send(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
  fresh = false
) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${await token(fresh)}`,
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(config.apiBaseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// Clerk session tokens are short-lived, so a 401 gets one retry with a fresh token before sending the user to sign in.
async function authorized(path: string, options?: RequestOptions) {
  let response = await send(path, options)
  if (response.status === 401) response = await send(path, options, true)
  if (response.ok) return response
  const data: unknown = await response.json().catch(() => ({}))
  const detail =
    typeof data === 'object' &&
    data !== null &&
    'detail' in data &&
    typeof data.detail === 'string'
      ? data.detail
      : `Request failed (${response.status}). Try again.`
  if (response.status === 401) location.assign(signInUrl())
  throw new ApiError(response.status, detail)
}

export async function api<T>(path: string, options: RequestOptions = {}) {
  const response = await authorized(path, options)
  return (response.status === 204 ? {} : await response.json()) as T
}

export async function fetchFile(path: string) {
  const response = await authorized(path)
  return {
    blob: await response.blob(),
    filename: filenameFrom(response.headers.get('Content-Disposition')),
  }
}

export async function download(path: string) {
  const { blob, filename } = await fetchFile(path)
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: filename || 'download',
  })
  document.body.append(link)
  link.click()
  link.remove()
  // Give the browser time to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
