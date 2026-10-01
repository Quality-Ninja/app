// Query strings exactly as the pages have always written them (?deleted=1, ?next=%2Fworkflow%2F1). The extension,
// Stripe, and the sign-in allowlist depend on them. TanStack Router's default serializer JSON-encodes values that look
// like JSON, which would turn deleted=1 into deleted=%221%22 and read ?deleted=1 back as a number.

export function parseSearch(search: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(search))
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}
