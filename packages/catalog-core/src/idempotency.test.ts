import { describe, expect, it } from 'vitest'
import type { CatalogRecord } from '@vidriera/contracts'
import { shouldSkipIndexing } from './idempotency'

const baseRecord: CatalogRecord = {
  objectID: 'product-1',
  revision: 'rev-1',
  slug: 'product-1',
  name: 'Product One',
  description: undefined,
  price: 100,
  currency: 'ARS',
  inStock: true,
  category: null,
  images: [],
  attributes: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('shouldSkipIndexing', () => {
  it('returns false when no object is currently indexed', () => {
    expect(shouldSkipIndexing(null, 'rev-1')).toBe(false)
  })

  it('returns false when the indexed revision differs from the incoming one', () => {
    expect(shouldSkipIndexing(baseRecord, 'rev-2')).toBe(false)
  })

  it('returns true when the indexed revision matches the incoming one', () => {
    expect(shouldSkipIndexing(baseRecord, 'rev-1')).toBe(true)
  })
})
