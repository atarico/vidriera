import type { CatalogRecord, ImageRenditions } from '@vidriera/contracts'

/**
 * Domain-owned ports for the compute layer.
 *
 * These interfaces belong to the domain, not to any vendor. Every adapter
 * (Sanity, Algolia, Cloudinary, SQS) implements one of these and is the only
 * place in the repository allowed to import that vendor's SDK.
 */

/**
 * A Sanity document as read back from the Content Lake, already reduced by
 * the ContentSource's GROQ projection to the fields the domain needs:
 * core CatalogRecord fields plus a flat `attributes` bag keyed by the rubro
 * profile's attribute names, and `imageSourceUrls` for ImageStore input.
 */
export interface SourceDocument {
  _id: string
  _rev: string
  slug: string
  name: string
  description?: string
  price?: number | null
  currency: string
  inStock?: boolean
  category?: string | null
  attributes?: Record<string, unknown>
  updatedAt: string
  imageSourceUrls: string[]
}

export interface ContentSource {
  /** Returns null when the document does not exist (already deleted). */
  getDocument(documentId: string): Promise<SourceDocument | null>
  /**
   * Paginated walk of every document the reindex worker must push. Each
   * call returns up to `limit` documents whose Sanity `_id` sorts strictly
   * after `cursor` (undefined for the first page), and the cursor to use
   * for the next page (undefined once the walk is exhausted).
   */
  listDocuments(
    cursor: string | undefined,
    limit: number,
  ): Promise<{
    documents: SourceDocument[]
    nextCursor: string | undefined
  }>
}

export interface ImageStore {
  /**
   * Uploads (or reuses, if already uploaded) the image at sourceUrl and
   * returns the derived card/hero/og/lqip rendition URLs. publicIdSeed
   * must be deterministic per source image so a replay does not re-upload.
   */
  deriveRenditions(publicIdSeed: string, sourceUrl: string): Promise<ImageRenditions>
}

export interface IndexSettings {
  searchableAttributes: string[]
  attributesForFaceting: string[]
}

export interface SearchIndex {
  /** Returns null when no object with that objectID is currently indexed. */
  getObject(objectID: string): Promise<CatalogRecord | null>
  saveObject(record: CatalogRecord): Promise<void>
  deleteObject(objectID: string): Promise<void>
  applySettings(settings: IndexSettings): Promise<void>
}

export interface RebuildTrigger {
  /**
   * Asks the storefront build pipeline to rebuild. `reason` is a short,
   * human-readable note for the build logs. Implementations may throw (network
   * errors, non-2xx responses); callers decide how to contain the failure —
   * a failed rebuild request must never fail the indexing work that preceded it.
   */
  trigger(reason: string): Promise<void>
}
