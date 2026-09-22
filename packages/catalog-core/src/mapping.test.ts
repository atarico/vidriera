import { describe, expect, it } from 'vitest'
import type { RubroProfile } from '@vidriera/contracts'
import { mapDocumentToCatalogRecord } from './mapping'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [
    { name: 'brand', title: 'Brand', type: 'string', facet: true, searchable: true },
    { name: 'tags', title: 'Tags', type: 'stringList', facet: true },
  ],
}

describe('mapDocumentToCatalogRecord', () => {
  it('maps core fields and profile-driven attributes generically', () => {
    const record = mapDocumentToCatalogRecord(
      {
        _id: 'product-1',
        _rev: 'rev-1',
        slug: 'product-1',
        name: 'Product One',
        description: 'A nice product',
        price: 1999,
        currency: 'ARS',
        inStock: true,
        category: 'category-1',
        attributes: { brand: 'Acme', tags: ['new', 'sale'], unknownField: 'ignored-at-source' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        imageSourceUrls: ['https://source/1.jpg'],
      },
      profile,
      [{ card: 'https://cdn/card.jpg', hero: 'https://cdn/hero.jpg', og: 'https://cdn/og.jpg' }],
    )

    expect(record).toEqual({
      objectID: 'product-1',
      revision: 'rev-1',
      slug: 'product-1',
      name: 'Product One',
      description: 'A nice product',
      price: 1999,
      currency: 'ARS',
      inStock: true,
      category: 'category-1',
      images: [{ card: 'https://cdn/card.jpg', hero: 'https://cdn/hero.jpg', og: 'https://cdn/og.jpg' }],
      attributes: { brand: 'Acme', tags: ['new', 'sale'] },
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('only carries attributes declared in the rubro profile, never source fields the profile does not know about', () => {
    const record = mapDocumentToCatalogRecord(
      {
        _id: 'product-2',
        _rev: 'rev-1',
        slug: 'product-2',
        name: 'Product Two',
        currency: 'ARS',
        attributes: { brand: 'Acme', somethingElse: 'nope' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        imageSourceUrls: [],
      },
      profile,
      [],
    )

    expect(record.attributes).toEqual({ brand: 'Acme' })
  })

  it('defaults price to null, inStock to false and category to null when absent from the source document', () => {
    const record = mapDocumentToCatalogRecord(
      {
        _id: 'product-3',
        _rev: 'rev-1',
        slug: 'product-3',
        name: 'Product Three',
        currency: 'ARS',
        updatedAt: '2026-01-01T00:00:00.000Z',
        imageSourceUrls: [],
      },
      profile,
      [],
    )

    expect(record.price).toBeNull()
    expect(record.inStock).toBe(false)
    expect(record.category).toBeNull()
  })
})
