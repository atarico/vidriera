import type { CatalogRecord } from '@vidriera/contracts'

/**
 * Pure idempotency decision for the indexer.
 *
 * CatalogRecord.revision (the Sanity _rev) is the idempotency key. If the
 * object already indexed under the same objectID carries the same revision,
 * the write — and any image upload that would precede it — must be skipped.
 */
export function shouldSkipIndexing(existing: CatalogRecord | null, incomingRevision: string): boolean {
  return existing !== null && existing.revision === incomingRevision
}
