import { CORE_RECORD_FIELDS } from './types'
import type { RubroProfile } from './types'

/**
 * Pure derivation functions over a RubroProfile.
 *
 * These are the only functions Studio and the indexer should use to turn a
 * rubro profile into Algolia settings and validation feedback — never
 * duplicate this logic elsewhere.
 */

/**
 * Ordered list of Algolia searchableAttributes: always name, then
 * description, then profile attributes marked searchable, in declaration
 * order. Never contains duplicates.
 */
export function searchableAttributes(profile: RubroProfile): string[] {
  const result: string[] = ['name', 'description']
  const seen = new Set(result)

  for (const attribute of profile.attributes) {
    if (attribute.searchable === true && !seen.has(attribute.name)) {
      result.push(attribute.name)
      seen.add(attribute.name)
    }
  }

  return result
}

/**
 * Ordered list of Algolia facet attributes: always category and inStock,
 * then profile attributes marked facet: true. Facets named in
 * profile.facetOrder come first (in that order); remaining facets follow in
 * declaration order. Never contains duplicates.
 */
export function attributesForFaceting(profile: RubroProfile): string[] {
  const result: string[] = ['category', 'inStock']
  const seen = new Set(result)

  const facetNames = new Set(profile.attributes.filter((a) => a.facet === true).map((a) => a.name))

  for (const name of profile.facetOrder ?? []) {
    if (facetNames.has(name) && !seen.has(name)) {
      result.push(name)
      seen.add(name)
    }
  }

  for (const attribute of profile.attributes) {
    if (attribute.facet === true && !seen.has(attribute.name)) {
      result.push(attribute.name)
      seen.add(attribute.name)
    }
  }

  return result
}

const CORE_FIELD_SET = new Set<string>(CORE_RECORD_FIELDS)

/**
 * Validates a RubroProfile and returns human-readable problem descriptions.
 * An empty array means the profile is valid. An empty attributes array is
 * valid on its own.
 */
export function validateProfile(profile: RubroProfile): string[] {
  const problems: string[] = []

  const seenNames = new Set<string>()
  const declaredNames = new Set<string>()

  for (const attribute of profile.attributes) {
    declaredNames.add(attribute.name)

    if (seenNames.has(attribute.name)) {
      problems.push(`Duplicate attribute name: "${attribute.name}"`)
    } else {
      seenNames.add(attribute.name)
    }

    const optionsAllowed = attribute.type === 'string' || attribute.type === 'stringList'
    if (attribute.options !== undefined && !optionsAllowed) {
      problems.push(
        `Attribute "${attribute.name}" declares options but its type is "${attribute.type}"; ` +
          `options is only valid for "string" or "stringList"`,
      )
    }

    if (CORE_FIELD_SET.has(attribute.name)) {
      problems.push(`Attribute "${attribute.name}" collides with a core CatalogRecord field name`)
    }
  }

  for (const name of profile.facetOrder ?? []) {
    if (!declaredNames.has(name)) {
      problems.push(`facetOrder references "${name}", which is not a declared attribute`)
    }
  }

  return problems
}
