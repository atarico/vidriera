import type { AttributeValue, CatalogRecord, ImageRenditions, RubroProfile } from '@vidriera/contracts'
import type { SourceDocument } from './ports'

/**
 * Pure mapping from a Sanity source document to a CatalogRecord.
 *
 * Driven entirely by the RubroProfile: only attributes the profile declares
 * are carried into CatalogRecord.attributes, so a vertical swap never
 * requires touching this function. Image renditions are passed in already
 * derived — deriving them is an ImageStore port call, not a pure operation.
 */
export function mapDocumentToCatalogRecord(
  doc: SourceDocument,
  profile: RubroProfile,
  images: ImageRenditions[],
): CatalogRecord {
  const attributes: Record<string, AttributeValue> = {}
  for (const definition of profile.attributes) {
    const value = doc.attributes?.[definition.name]
    if (value !== undefined) {
      attributes[definition.name] = value as AttributeValue
    }
  }

  return {
    objectID: doc._id,
    revision: doc._rev,
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    price: doc.price ?? null,
    currency: doc.currency,
    inStock: doc.inStock ?? false,
    category: doc.category ?? null,
    images,
    attributes,
    updatedAt: doc.updatedAt,
  }
}
