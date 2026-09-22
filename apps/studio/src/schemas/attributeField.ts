import { defineField } from 'sanity'
import type { AttributeDefinition } from '@vidriera/contracts'

/**
 * Maps a rubro-agnostic AttributeDefinition (from @vidriera/contracts) to a
 * concrete Sanity field definition. This is the correctness-critical bridge
 * between the swap-point rubro profile and the actual Studio schema.
 *
 * Each branch calls defineField directly with a literal object (rather than
 * building a shared object and spreading it in) so TypeScript can
 * contextually infer the exact Rule type Sanity expects for the `validation`
 * callback of that specific field type.
 */
export function attributeToSanityField(attribute: AttributeDefinition) {
  const optionsList = attribute.options?.map((value) => ({ title: value, value }))
  const required = attribute.required === true

  switch (attribute.type) {
    case 'string':
      return required
        ? defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'string',
            ...(optionsList ? { options: { list: optionsList } } : {}),
            validation: (rule) => rule.required(),
          })
        : defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'string',
            ...(optionsList ? { options: { list: optionsList } } : {}),
          })
    case 'number':
      return required
        ? defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'number',
            validation: (rule) => rule.required(),
          })
        : defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'number',
          })
    case 'boolean':
      return required
        ? defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'boolean',
            validation: (rule) => rule.required(),
          })
        : defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'boolean',
          })
    case 'stringList':
      return required
        ? defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'array',
            of: [{ type: 'string' }],
            ...(optionsList ? { options: { list: optionsList } } : {}),
            validation: (rule) => rule.required(),
          })
        : defineField({
            name: attribute.name,
            title: attribute.title,
            type: 'array',
            of: [{ type: 'string' }],
            ...(optionsList ? { options: { list: optionsList } } : {}),
          })
    default: {
      const exhaustive: never = attribute.type
      throw new Error(`Unhandled attribute type: ${String(exhaustive)}`)
    }
  }
}
