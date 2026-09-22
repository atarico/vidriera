import { describe, expect, it } from 'vitest'
import { isAlgoliaNotFoundError } from './algoliaSearchIndex'

describe('isAlgoliaNotFoundError', () => {
  it('recognizes a v5-shaped 404 ApiError', () => {
    expect(isAlgoliaNotFoundError({ status: 404, message: 'ObjectID does not exist' })).toBe(true)
  })

  it('rejects other status codes', () => {
    expect(isAlgoliaNotFoundError({ status: 500, message: 'Server error' })).toBe(false)
  })

  it('rejects non-error values', () => {
    expect(isAlgoliaNotFoundError(null)).toBe(false)
    expect(isAlgoliaNotFoundError('boom')).toBe(false)
    expect(isAlgoliaNotFoundError(undefined)).toBe(false)
  })
})
