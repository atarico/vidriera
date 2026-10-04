import { describe, expect, it } from 'vitest'
import type { CatalogRecord, RubroProfile } from '@vidriera/contracts'
import { productAttributeEntries } from './productAttributes'

function record(attributes: CatalogRecord['attributes']): CatalogRecord {
  return {
    objectID: 'p1',
    revision: 'r1',
    slug: 'p1',
    name: 'Product',
    price: 100,
    currency: 'ARS',
    inStock: true,
    category: 'general',
    images: [],
    attributes,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const profile: RubroProfile = {
  id: 'test',
  title: 'Test',
  productNoun: { singular: 'item', plural: 'items' },
  attributes: [
    { name: 'brand', title: 'Marca', type: 'string' },
    { name: 'isHandmade', title: 'Hecho a mano', type: 'boolean' },
    { name: 'tags', title: 'Etiquetas', type: 'stringList' },
    { name: 'weightKg', title: 'Peso (kg)', type: 'number' },
  ],
}

describe('productAttributeEntries', () => {
  it('formats a string attribute as-is', () => {
    const entries = productAttributeEntries(record({ brand: 'Acme' }), profile)
    expect(entries).toContainEqual({ label: 'Marca', value: 'Acme' })
  })

  it('formats a boolean attribute as Sí/No', () => {
    const entries = productAttributeEntries(record({ isHandmade: true }), profile)
    expect(entries).toContainEqual({ label: 'Hecho a mano', value: 'Sí' })
    const entriesFalse = productAttributeEntries(record({ isHandmade: false }), profile)
    expect(entriesFalse).toContainEqual({ label: 'Hecho a mano', value: 'No' })
  })

  it('formats a stringList attribute as a comma-separated list', () => {
    const entries = productAttributeEntries(record({ tags: ['nuevo', 'oferta'] }), profile)
    expect(entries).toContainEqual({ label: 'Etiquetas', value: 'nuevo, oferta' })
  })

  it('formats a number attribute using locale grouping', () => {
    const entries = productAttributeEntries(record({ weightKg: 1234 }), profile)
    expect(entries.find((e) => e.label === 'Peso (kg)')?.value).toMatch(/1[.,]234/)
  })

  it('skips attributes the record does not have a value for', () => {
    const entries = productAttributeEntries(record({ brand: 'Acme' }), profile)
    expect(entries.map((e) => e.label)).toEqual(['Marca'])
  })

  it('skips profile attributes not present on the record at all (undefined)', () => {
    const entries = productAttributeEntries(record({}), profile)
    expect(entries).toEqual([])
  })

  it('preserves profile declaration order', () => {
    const entries = productAttributeEntries(
      record({ weightKg: 1, brand: 'Acme', isHandmade: true }),
      profile,
    )
    expect(entries.map((e) => e.label)).toEqual(['Marca', 'Hecho a mano', 'Peso (kg)'])
  })
})
