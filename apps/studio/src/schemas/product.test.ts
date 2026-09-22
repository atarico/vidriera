import { describe, expect, it } from 'vitest'
import type { AttributeDefinition, RubroProfile } from '@vidriera/contracts'
import { buildProductSchema } from './product'

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

function fieldsOf(schema: ReturnType<typeof buildProductSchema>) {
  return (schema.fields ?? []) as Array<{ name: string; type: string; [k: string]: unknown }>
}

describe('buildProductSchema', () => {
  it('is a document type named "product"', () => {
    const schema = buildProductSchema(profile())
    expect(schema.name).toBe('product')
    expect(schema.type).toBe('document')
  })

  it('always includes the hardcoded core fields', () => {
    const fields = fieldsOf(buildProductSchema(profile()))
    const names = fields.map((f) => f.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'inStock',
        'category',
        'images',
      ]),
    )
  })

  it('maps the category core field to a reference field', () => {
    const fields = fieldsOf(buildProductSchema(profile()))
    const category = fields.find((f) => f.name === 'category')
    expect(category?.type).toBe('reference')
  })

  it('maps the images core field to an array of image objects', () => {
    const fields = fieldsOf(buildProductSchema(profile()))
    const images = fields.find((f) => f.name === 'images')
    expect(images?.type).toBe('array')
    expect((images as { of?: Array<{ type: string }> }).of?.[0]?.type).toBe('image')
  })

  it('generates one Sanity field per profile attribute, using its name and title', () => {
    const p = profile({
      attributes: [
        attr({ name: 'brand', title: 'Brand', type: 'string' }),
        attr({ name: 'weight', title: 'Weight', type: 'number' }),
      ],
    })
    const fields = fieldsOf(buildProductSchema(p))
    const brand = fields.find((f) => f.name === 'brand')
    const weight = fields.find((f) => f.name === 'weight')
    expect(brand).toMatchObject({ name: 'brand', title: 'Brand', type: 'string' })
    expect(weight).toMatchObject({ name: 'weight', title: 'Weight', type: 'number' })
  })

  it('maps AttributeType to the correct Sanity field type', () => {
    const p = profile({
      attributes: [
        attr({ name: 'a', type: 'string' }),
        attr({ name: 'b', type: 'number' }),
        attr({ name: 'c', type: 'boolean' }),
        attr({ name: 'd', type: 'stringList' }),
      ],
    })
    const fields = fieldsOf(buildProductSchema(p))
    expect(fields.find((f) => f.name === 'a')?.type).toBe('string')
    expect(fields.find((f) => f.name === 'b')?.type).toBe('number')
    expect(fields.find((f) => f.name === 'c')?.type).toBe('boolean')
    expect(fields.find((f) => f.name === 'd')?.type).toBe('array')
  })

  it('maps stringList to an array of strings', () => {
    const p = profile({ attributes: [attr({ name: 'tags', type: 'stringList' })] })
    const fields = fieldsOf(buildProductSchema(p))
    const tags = fields.find((f) => f.name === 'tags') as { of?: Array<{ type: string }> }
    expect(tags.of).toEqual([{ type: 'string' }])
  })

  it('maps options to options.list as {title, value} pairs for a string attribute', () => {
    const p = profile({
      attributes: [attr({ name: 'color', type: 'string', options: ['red', 'blue'] })],
    })
    const fields = fieldsOf(buildProductSchema(p))
    const color = fields.find((f) => f.name === 'color') as {
      options?: { list?: Array<{ title: string; value: string }> }
    }
    expect(color.options?.list).toEqual([
      { title: 'red', value: 'red' },
      { title: 'blue', value: 'blue' },
    ])
  })

  it('maps options to options.list for a stringList attribute', () => {
    const p = profile({
      attributes: [attr({ name: 'sizes', type: 'stringList', options: ['S', 'M', 'L'] })],
    })
    const fields = fieldsOf(buildProductSchema(p))
    const sizes = fields.find((f) => f.name === 'sizes') as {
      options?: { list?: Array<{ title: string; value: string }> }
    }
    expect(sizes.options?.list).toEqual([
      { title: 'S', value: 'S' },
      { title: 'M', value: 'M' },
      { title: 'L', value: 'L' },
    ])
  })

  it('omits options when the attribute does not declare any', () => {
    const p = profile({ attributes: [attr({ name: 'brand', type: 'string' })] })
    const fields = fieldsOf(buildProductSchema(p))
    const brand = fields.find((f) => f.name === 'brand') as { options?: unknown }
    expect(brand.options).toBeUndefined()
  })

  it('marks a required attribute with a validation rule', () => {
    const p = profile({ attributes: [attr({ name: 'sku', required: true })] })
    const fields = fieldsOf(buildProductSchema(p))
    const sku = fields.find((f) => f.name === 'sku') as { validation?: unknown }
    expect(sku.validation).toBeDefined()
  })

  it('leaves validation unset for a non-required attribute', () => {
    const p = profile({ attributes: [attr({ name: 'note' })] })
    const fields = fieldsOf(buildProductSchema(p))
    const note = fields.find((f) => f.name === 'note') as { validation?: unknown }
    expect(note.validation).toBeUndefined()
  })

  it('is driven entirely by the profile: different profiles produce different generated fields', () => {
    const shoeProfile = profile({
      attributes: [
        attr({ name: 'size', type: 'string' }),
        attr({ name: 'material', type: 'string' }),
      ],
    })
    const bikeProfile = profile({
      attributes: [
        attr({ name: 'wheelSize', type: 'number' }),
        attr({ name: 'gearCount', type: 'number' }),
      ],
    })

    const shoeNames = fieldsOf(buildProductSchema(shoeProfile)).map((f) => f.name)
    const bikeNames = fieldsOf(buildProductSchema(bikeProfile)).map((f) => f.name)

    expect(shoeNames).toEqual(expect.arrayContaining(['size', 'material']))
    expect(bikeNames).toEqual(expect.arrayContaining(['wheelSize', 'gearCount']))
    expect(shoeNames).not.toEqual(expect.arrayContaining(['wheelSize']))
    expect(bikeNames).not.toEqual(expect.arrayContaining(['size']))
  })
})
