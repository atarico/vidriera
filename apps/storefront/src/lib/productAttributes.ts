import type { CatalogRecord, RubroProfile } from '@vidriera/contracts'

export interface ProductAttributeEntry {
  label: string
  value: string
}

/**
 * Formats a product's rubro-specific attributes for display on the detail
 * page, driven entirely by the active RubroProfile's attribute
 * declarations — same principle as buildFacetConfig: no attribute name is
 * hardcoded, and the set/order shown follows the profile.
 */
export function productAttributeEntries(
  record: CatalogRecord,
  profile: RubroProfile,
): ProductAttributeEntry[] {
  const entries: ProductAttributeEntry[] = []

  for (const definition of profile.attributes) {
    const value = record.attributes[definition.name]
    if (value === undefined) continue

    entries.push({ label: definition.title, value: formatAttributeValue(value) })
  }

  return entries
}

function formatAttributeValue(value: CatalogRecord['attributes'][string]): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'number') return value.toLocaleString('es-AR')
  return value
}
