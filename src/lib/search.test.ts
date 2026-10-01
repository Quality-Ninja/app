import { describe, expect, it } from 'vitest'
import { parseSearch, stringifySearch } from './search'

describe('search params', () => {
  it('write the query strings the extension, Stripe, and sign-in use', () => {
    expect(stringifySearch({ deleted: '1' })).toBe('?deleted=1')
    expect(stringifySearch({ checkout: 'success' })).toBe('?checkout=success')
    expect(stringifySearch({ next: '/workflow/1' })).toBe(
      '?next=%2Fworkflow%2F1'
    )
    expect(stringifySearch({ mode: 'signup', next: '/account' })).toBe(
      '?mode=signup&next=%2Faccount'
    )
    expect(stringifySearch({ mode: undefined, next: undefined })).toBe('')
  })

  it('read every value as text', () => {
    expect(parseSearch('?deleted=1&next=%2Fworkflow%2F1')).toEqual({
      deleted: '1',
      next: '/workflow/1',
    })
    expect(parseSearch('')).toEqual({})
  })
})
