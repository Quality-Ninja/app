// The API names every file: attachment; filename="…", or filename*=UTF-8''… for non-ASCII names.
export function filenameFrom(header: string | null) {
  if (!header) return ''
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1])
    } catch {
      // Fall back to the plain name.
    }
  }
  return /filename="?([^";]+)"?/i.exec(header)?.[1] ?? ''
}
