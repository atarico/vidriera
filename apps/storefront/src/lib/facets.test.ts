import { describe, expect, it } from 'vitest'
import type { RubroProfile } from '@vidriera/contracts'
import { buildFacetConfig } from './facets'

function profile(overrides: Partial<RubroProfile> = {}): RubroProfile {
  return {
    id: 'test-rubro',
    title: 'Test Rubro',
    productNoun: { singular: 'item', plural: 'items' },
    attributes: [],
    ...overrides,
  }
}

describe('buildFacetConfig', () => {
  it('always includes the core category and inStock facets', () => {
    const config = buildFacetConfig(profile())
    expect(config.map((f) => f.attribute)).toEqual(['category', 'inStock'])
  })

  it('renders the core inStock facet as a toggle and category as a refinement list', () => {
    const config = buildFacetConfig(profile())
    expect(config.find((f) => f.attribute === 'category')?.kind).toBe('refinementList')
    expect(config.find((f) => f.attribute === 'inStock')?.kind).toBe('toggle')
  })

  it('appends profile attributes marked facet: true, in the order attributesForFaceting returns', () => {
    const config = buildFacetConfig(
      profile({
        attributes: [
          { name: 'brand', title: 'Marca', type: 'string', facet: true },
          { name: 'material', title: 'Material', type: 'string', facet: true },
        ],
      }),
    )
    expect(config.map((f) => f.attribute)).toEqual(['category', 'inStock', 'brand', 'material'])
  })

  it('uses the attribute title from the profile as the facet label', () => {
    const config = buildFacetConfig(
      profile({ attributes: [{ name: 'brand', title: 'Marca', type: 'string', facet: true }] }),
    )
    expect(config.find((f) => f.attribute === 'brand')?.label).toBe('Marca')
  })

  it('renders a boolean profile attribute as a toggle, not a refinement list', () => {
    const config = buildFacetConfig(
      profile({
        attributes: [{ name: 'isHandmade', title: 'Hecho a mano', type: 'boolean', facet: true }],
      }),
    )
    expect(config.find((f) => f.attribute === 'isHandmade')?.kind).toBe('toggle')
  })

  it('renders a string or stringList profile attribute as a refinement list', () => {
    const config = buildFacetConfig(
      profile({
        attributes: [{ name: 'tags', title: 'Etiquetas', type: 'stringList', facet: true }],
      }),
    )
    expect(config.find((f) => f.attribute === 'tags')?.kind).toBe('refinementList')
  })

  it('excludes profile attributes not marked facet: true', () => {
    const config = buildFacetConfig(
      profile({ attributes: [{ name: 'sku', title: 'SKU', type: 'string' }] }),
    )
    expect(config.some((f) => f.attribute === 'sku')).toBe(false)
  })

  it('THE PAYOFF: two different rubro profiles produce two different filter sets', () => {
    const bookshopProfile = profile({
      id: 'bookshop',
      attributes: [
        { name: 'author', title: 'Autor', type: 'string', facet: true },
        { name: 'genre', title: 'Género', type: 'string', facet: true },
      ],
    })
    const plantShopProfile = profile({
      id: 'plant-shop',
      attributes: [
        { name: 'lightNeeds', title: 'Necesidad de luz', type: 'string', facet: true },
        { name: 'petSafe', title: 'Apto mascotas', type: 'boolean', facet: true },
      ],
    })

    const bookshopFacets = buildFacetConfig(bookshopProfile)
    const plantShopFacets = buildFacetConfig(plantShopProfile)

    expect(bookshopFacets.map((f) => f.attribute)).toEqual([
      'category',
      'inStock',
      'author',
      'genre',
    ])
    expect(plantShopFacets.map((f) => f.attribute)).toEqual([
      'category',
      'inStock',
      'lightNeeds',
      'petSafe',
    ])
    expect(bookshopFacets.map((f) => f.attribute)).not.toEqual(
      plantShopFacets.map((f) => f.attribute),
    )
    // The vertical swap also changes widget kinds: petSafe is a boolean toggle,
    // nothing in the bookshop profile is.
    expect(plantShopFacets.find((f) => f.attribute === 'petSafe')?.kind).toBe('toggle')
    expect(bookshopFacets.some((f) => f.kind === 'toggle' && f.attribute !== 'inStock')).toBe(
      false,
    )
  })
})
