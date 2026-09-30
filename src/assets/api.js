// Calls the QA Ninja API with the signed-in user's Clerk token. The API ignores cookies, so files and screenshots
// are fetched here too and handed to the page as blobs; tokens never appear in a URL.
import { signInUrl, token } from './auth.js';

const base = window.QaNinjaConfig?.apiBaseUrl || '';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function send(path, { method = 'GET', body } = {}, fresh = false) {
  const headers = { Accept: 'application/json', Authorization: `Bearer ${await token(fresh)}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Clerk session tokens are short-lived, so a 401 gets one retry with a fresh token before sending the user to sign in.
async function authorized(path, options) {
  let response = await send(path, options);
  if (response.status === 401) response = await send(path, options, true);
  if (response.ok) return response;
  const data = await response.json().catch(() => ({}));
  const detail = typeof data.detail === 'string' ? data.detail : `Request failed (${response.status}). Try again.`;
  if (response.status === 401) location.assign(signInUrl());
  throw new ApiError(response.status, detail);
}

export async function api(path, options = {}) {
  const response = await authorized(path, options);
  return response.status === 204 ? {} : response.json();
}

export async function fetchFile(path) {
  const response = await authorized(path);
  return { blob: await response.blob(), filename: filenameFrom(response.headers.get('Content-Disposition')) };
}

export async function download(path) {
  const { blob, filename } = await fetchFile(path);
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename || 'download' });
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// The API names every file (attachment; filename="…", or filename*=UTF-8''… for non-ASCII names).
function filenameFrom(header) {
  if (!header) return '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try { return decodeURIComponent(encoded[1]); } catch { /* fall back to the plain name */ }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1] || '';
}
