import { describe, expect, it } from 'vitest'
import type { RubroProfile } from '@vidriera/contracts'
import { buildProductProjection } from './sanityContentSource'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [
    { name: 'brand', title: 'Brand', type: 'string', facet: true, searchable: true },
    { name: 'tags', title: 'Tags', type: 'stringList', facet: true },
  ],
}

describe('buildProductProjection', () => {
  it('includes every core field the domain needs', () => {
    const projection = buildProductProjection(profile)
    for (const field of ['_id', '_rev', '"slug": slug.current', 'name', 'description', 'price', 'currency', 'inStock']) {
      expect(projection).toContain(field)
    }
  })

  it('projects every rubro-profile attribute by name, flat at the document root', () => {
    const projection = buildProductProjection(profile)
    expect(projection).toContain('"brand": brand')
    expect(projection).toContain('"tags": tags')
  })

  it('projects imageSourceUrls as an array even when the product has no images', () => {
    // GROQ yields null for `images[].asset->url` when `images` is unset, and
    // the indexer maps over this field unguarded.
    const projection = buildProductProjection(profile)
    expect(projection).toContain('"imageSourceUrls": coalesce(images[defined(asset)].asset->url, [])')
  })

  it('never hardcodes an attribute name absent from the profile', () => {
    const projection = buildProductProjection({ ...profile, attributes: [] })
    expect(projection).not.toContain('brand')
    expect(projection).not.toContain('tags')
  })
})
