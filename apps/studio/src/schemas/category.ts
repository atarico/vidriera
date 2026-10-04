import { defineField, defineType } from 'sanity'

/**
 * The "category" document schema. Categories are rubro-neutral: a taxonomy
 * container with a title and a slug. Vertical-specific category shapes are
 * out of scope — categories are just referenced by "product" documents.
 */
export const categorySchema = defineType({
  name: 'category',
  title: 'Category',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
  ],
})
