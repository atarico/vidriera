import type { RubroProfile } from '@vidriera/contracts'
import { buildIndexSettings, mapDocumentToCatalogRecord, shouldSkipIndexing } from '@vidriera/catalog-core'
import type { ContentSource, ImageStore, SearchIndex } from '@vidriera/catalog-core'
import type { Throttler } from './throttle'

export interface ReindexDeps {
  contentSource: ContentSource
  imageStore: ImageStore
  searchIndex: SearchIndex
  profile: RubroProfile
  throttler: Throttler
  pageSize: number
}

export interface ReindexSummary {
  indexed: number
  skipped: number
  failed: number
  failedDocumentIds: string[]
}

/**
 * Walks every product document in Sanity (paginated), reusing the exact
 * same idempotency check and mapping the indexer uses so a full reindex
 * never re-uploads an image or rewrites an already-current record. Paced
 * by the injected throttler between writes to respect Algolia's rate
 * limits. A failing document is reported and the walk continues — the
 * whole job only fails (non-zero exit, at the process entry point) if
 * anything failed overall.
 */
export async function reindexAll(deps: ReindexDeps): Promise<ReindexSummary> {
  await deps.searchIndex.applySettings(buildIndexSettings(deps.profile))

  let cursor: string | undefined
  let indexed = 0
  let skipped = 0
  let failed = 0
  const failedDocumentIds: string[] = []

  do {
    const { documents, nextCursor } = await deps.contentSource.listDocuments(cursor, deps.pageSize)

    for (const doc of documents) {
      try {
        const existing = await deps.searchIndex.getObject(doc._id)
        if (shouldSkipIndexing(existing, doc._rev)) {
          skipped += 1
        } else {
          const images = await Promise.all(
            doc.imageSourceUrls.map((url, index) => deps.imageStore.deriveRenditions(`${doc._id}-${index}`, url)),
          )
          const record = mapDocumentToCatalogRecord(doc, deps.profile, images)
          await deps.searchIndex.saveObject(record)
          indexed += 1
        }
      } catch (error) {
        failed += 1
        failedDocumentIds.push(doc._id)
        console.error(`Failed to reindex ${doc._id}`, error)
      }

      await deps.throttler.wait()
    }

    cursor = nextCursor
  } while (cursor !== undefined)

  return { indexed, skipped, failed, failedDocumentIds }
}
