/**
 * Core shared types for the Vidriera catalog platform.
 *
 * This module is the single interface every other package (Studio, ingest,
 * indexer, replay, reindex-worker, storefront) depends on. It is intentionally
 * rubro-agnostic: nothing here may reference a specific vertical's fields.
 */

export type AttributeType = 'string' | 'number' | 'boolean' | 'stringList'

export interface AttributeDefinition {
  /** Machine name: Sanity field name AND Algolia attribute name. */
  name: string
  /** Human label for Studio and storefront. */
  title: string
  type: AttributeType
  /** Becomes an Algolia facet and a storefront filter. */
  facet?: boolean
  /** Included in Algolia searchableAttributes. */
  searchable?: boolean
  /** Closed option list (only valid for 'string' / 'stringList'). */
  options?: string[]
  required?: boolean
}

export interface RubroProfile {
  id: string
  title: string
  productNoun: { singular: string; plural: string }
  attributes: AttributeDefinition[]
  /** Display order; names not listed fall back to declaration order. */
  facetOrder?: string[]
}

export interface ImageRenditions {
  card: string
  hero: string
  og: string
  lqip?: string
}

export type AttributeValue = string | number | boolean | string[]

export interface CatalogRecord {
  /** Sanity document _id. */
  objectID: string
  /** Sanity _rev — the idempotency key. */
  revision: string
  slug: string
  name: string
  description?: string
  price: number | null
  currency: string
  inStock: boolean
  category: string | null
  images: ImageRenditions[]
  attributes: Record<string, AttributeValue>
  /** ISO 8601. */
  updatedAt: string
}

export interface IngestMessage {
  documentId: string
  revision: string
  operation: 'upsert' | 'delete'
  /** ISO 8601. */
  receivedAt: string
}

/**
 * Field names reserved by CatalogRecord. A RubroProfile attribute must not
 * reuse one of these names — see validateProfile.
 */
export const CORE_RECORD_FIELDS = [
  'objectID',
  'revision',
  'slug',
  'name',
  'description',
  'price',
  'currency',
  'inStock',
  'category',
  'images',
  'attributes',
  'updatedAt',
] as const
