import type { IngestMessage, RubroProfile } from '@vidriera/contracts'
import { mapDocumentToCatalogRecord, shouldSkipIndexing } from '@vidriera/catalog-core'
import type { ContentSource, ImageStore, SearchIndex } from '@vidriera/catalog-core'

export type IndexMessageOutcome =
  | { status: 'indexed'; objectID: string }
  | { status: 'deleted'; objectID: string }
  | { status: 'skipped'; objectID: string }

export interface IndexMessageDeps {
  contentSource: ContentSource
  imageStore: ImageStore
  searchIndex: SearchIndex
  profile: RubroProfile
}

/**
 * The core indexing use case: fetch, decide, derive, write. Idempotency
 * (shouldSkipIndexing) is checked before any ImageStore call so a replay of
 * an already-indexed revision never re-uploads images.
 */
export async function indexMessage(message: IngestMessage, deps: IndexMessageDeps): Promise<IndexMessageOutcome> {
  if (message.operation === 'delete') {
    await deps.searchIndex.deleteObject(message.documentId)
    return { status: 'deleted', objectID: message.documentId }
  }

  const doc = await deps.contentSource.getDocument(message.documentId)
  if (doc === null) {
    // The webhook said upsert, but the document is gone by the time we
    // fetch it (e.g. deleted again before this message was processed).
    await deps.searchIndex.deleteObject(message.documentId)
    return { status: 'deleted', objectID: message.documentId }
  }

  const existing = await deps.searchIndex.getObject(doc._id)
  if (shouldSkipIndexing(existing, doc._rev)) {
    return { status: 'skipped', objectID: doc._id }
  }

  const images = await Promise.all(
    doc.imageSourceUrls.map((url, index) => deps.imageStore.deriveRenditions(`${doc._id}-${index}`, url)),
  )

  const record = mapDocumentToCatalogRecord(doc, deps.profile, images)
  await deps.searchIndex.saveObject(record)
  return { status: 'indexed', objectID: doc._id }
}
