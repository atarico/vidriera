import { describe, expect, it } from 'vitest'
import type { RubroProfile } from '@vidriera/contracts'
import { buildIndexSettings } from './indexSettings'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [
    { name: 'brand', title: 'Brand', type: 'string', facet: true, searchable: true },
    { name: 'tags', title: 'Tags', type: 'stringList', facet: true },
  ],
}

describe('buildIndexSettings', () => {
  it('derives Algolia index settings from the rubro profile via the contracts derivation functions', () => {
    expect(buildIndexSettings(profile)).toEqual({
      searchableAttributes: ['name', 'description', 'brand'],
      attributesForFaceting: ['category', 'inStock', 'brand', 'tags'],
    })
  })
})
