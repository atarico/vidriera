import { describe, expect, it } from 'vitest'
import { attributesForFaceting, searchableAttributes, validateProfile } from './derivation'
import type { AttributeDefinition, RubroProfile } from './types'

function attr(overrides: Partial<AttributeDefinition> & { name: string }): AttributeDefinition {
  return {
    title: overrides.name,
    type: 'string',
    ...overrides,
  }
}

function profile(overrides: Partial<RubroProfile> = {}): RubroProfile {
  return {
    id: 'test-rubro',
    title: 'Test Rubro',
    productNoun: { singular: 'item', plural: 'items' },
    attributes: [],
    ...overrides,
  }
}

describe('searchableAttributes', () => {
  it('always starts with name then description', () => {
    const result = searchableAttributes(profile())
    expect(result).toEqual(['name', 'description'])
  })

  it('appends profile attributes with searchable: true, in declaration order', () => {
    const p = profile({
      attributes: [
        attr({ name: 'brand', searchable: true }),
        attr({ name: 'color', searchable: false }),
        attr({ name: 'material', searchable: true }),
      ],
    })
    expect(searchableAttributes(p)).toEqual(['name', 'description', 'brand', 'material'])
  })

  it('excludes attributes where searchable is undefined', () => {
    const p = profile({ attributes: [attr({ name: 'sku' })] })
    expect(searchableAttributes(p)).toEqual(['name', 'description'])
  })

  it('never duplicates a name', () => {
    const p = profile({
      attributes: [
        attr({ name: 'name', searchable: true }),
        attr({ name: 'brand', searchable: true }),
      ],
    })
    const result = searchableAttributes(p)
    expect(result).toEqual(['name', 'description', 'brand'])
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('attributesForFaceting', () => {
  it('always includes category and inStock', () => {
    expect(attributesForFaceting(profile())).toEqual(['category', 'inStock'])
  })

  it('appends profile attributes with facet: true in declaration order when no facetOrder is given', () => {
    const p = profile({
      attributes: [
        attr({ name: 'brand', facet: true }),
        attr({ name: 'description_x', facet: false }),
        attr({ name: 'size', facet: true }),
      ],
    })
    expect(attributesForFaceting(p)).toEqual(['category', 'inStock', 'brand', 'size'])
  })

  it('orders facets by facetOrder first, then declaration order for the rest', () => {
    const p = profile({
      attributes: [
        attr({ name: 'brand', facet: true }),
        attr({ name: 'size', facet: true }),
        attr({ name: 'color', facet: true }),
      ],
      facetOrder: ['color', 'brand'],
    })
    expect(attributesForFaceting(p)).toEqual(['category', 'inStock', 'color', 'brand', 'size'])
  })

  it('ignores facetOrder names that are not facet attributes', () => {
    const p = profile({
      attributes: [attr({ name: 'brand', facet: true })],
      facetOrder: ['color', 'brand'],
    })
    expect(attributesForFaceting(p)).toEqual(['category', 'inStock', 'brand'])
  })

  it('never duplicates a name', () => {
    const p = profile({
      attributes: [attr({ name: 'category', facet: true })],
    })
    const result = attributesForFaceting(p)
    expect(result).toEqual(['category', 'inStock'])
    expect(new Set(result).size).toBe(result.length)
  })
})

describe('validateProfile', () => {
  it('returns no problems for a minimal valid profile', () => {
    expect(validateProfile(profile())).toEqual([])
  })

  it('allows an empty attributes array', () => {
    expect(validateProfile(profile({ attributes: [] }))).toEqual([])
  })

  it('catches duplicate attribute names', () => {
    const p = profile({
      attributes: [attr({ name: 'brand' }), attr({ name: 'brand' })],
    })
    const problems = validateProfile(p)
    expect(problems.some((msg) => /duplicate/i.test(msg) && /brand/.test(msg))).toBe(true)
  })

  it('catches options declared on a non-string/non-stringList type', () => {
    const p = profile({
      attributes: [attr({ name: 'weight', type: 'number', options: ['1kg', '2kg'] })],
    })
    const problems = validateProfile(p)
    expect(problems.some((msg) => /options/i.test(msg) && /weight/.test(msg))).toBe(true)
  })

  it('allows options on string and stringList attributes', () => {
    const p = profile({
      attributes: [
        attr({ name: 'color', type: 'string', options: ['red', 'blue'] }),
        attr({ name: 'tags', type: 'stringList', options: ['a', 'b'] }),
      ],
    })
    expect(validateProfile(p)).toEqual([])
  })

  it('catches an attribute named the same as a core record field', () => {
    const p = profile({ attributes: [attr({ name: 'price' })] })
    const problems = validateProfile(p)
    expect(problems.some((msg) => /price/.test(msg) && /core/i.test(msg))).toBe(true)
  })

  it('catches every core-field collision, not just the first', () => {
    const p = profile({
      attributes: [attr({ name: 'slug' }), attr({ name: 'category' })],
    })
    const problems = validateProfile(p)
    expect(problems.some((msg) => /slug/.test(msg))).toBe(true)
    expect(problems.some((msg) => /category/.test(msg))).toBe(true)
  })

  it('catches facetOrder referencing a name that is not a declared attribute', () => {
    const p = profile({
      attributes: [attr({ name: 'brand', facet: true })],
      facetOrder: ['brand', 'nonexistent'],
    })
    const problems = validateProfile(p)
    expect(problems.some((msg) => /facetOrder/.test(msg) && /nonexistent/.test(msg))).toBe(true)
  })

  it('accumulates multiple distinct problems at once', () => {
    const p = profile({
      attributes: [
        attr({ name: 'price' }),
        attr({ name: 'weight', type: 'number', options: ['x'] }),
      ],
      facetOrder: ['ghost'],
    })
    const problems = validateProfile(p)
    expect(problems.length).toBeGreaterThanOrEqual(3)
  })
})
