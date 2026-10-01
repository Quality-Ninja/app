import { describe, expect, it } from 'vitest'
import { filenameFrom } from './content-disposition'

describe('filenameFrom', () => {
  it('reads the plain and the encoded forms', () => {
    expect(filenameFrom('attachment; filename="QaNinja-1.zip"')).toBe(
      'QaNinja-1.zip'
    )
    expect(filenameFrom('attachment; filename=recording.json')).toBe(
      'recording.json'
    )
    expect(
      filenameFrom("attachment; filename*=utf-8''r%C3%A9sum%C3%A9.txt")
    ).toBe('résumé.txt')
  })

  it('falls back when the header is missing or broken', () => {
    expect(filenameFrom(null)).toBe('')
    expect(
      filenameFrom(
        `attachment; filename*=UTF-8''%E0%A4%A; filename="fallback.txt"`
      )
    ).toBe('fallback.txt')
  })
})
