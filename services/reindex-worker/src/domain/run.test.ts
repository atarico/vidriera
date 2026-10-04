import { describe, expect, it } from 'vitest'
import type { CatalogRecord, RubroProfile } from '@vidriera/contracts'
import type { ContentSource, ImageStore, IndexSettings, SearchIndex, SourceDocument } from '@vidriera/catalog-core'
import { reindexAll } from './run'
import type { Throttler } from './throttle'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [{ name: 'brand', title: 'Brand', type: 'string', facet: true, searchable: true }],
}

function doc(id: string, rev: string): SourceDocument {
  return {
    _id: id,
    _rev: rev,
    slug: id,
    name: `Name ${id}`,
    currency: 'ARS',
    inStock: true,
    attributes: { brand: 'Acme' },
    updatedAt: '2026-01-01T00:00:00.000Z',
    imageSourceUrls: [`https://source/${id}.jpg`],
  }
}

function pagedContentSource(pages: SourceDocument[][]): ContentSource {
  return {
    async getDocument() {
      return null
    },
    async listDocuments(cursor) {
      const pageIndex = cursor ? Number(cursor) : 0
      const documents = pages[pageIndex] ?? []
      const nextCursor = pageIndex + 1 < pages.length ? String(pageIndex + 1) : undefined
      return { documents, nextCursor }
    },
  }
}

function countingImageStore(): ImageStore & { uploadCount: number } {
  const state = { uploadCount: 0 }
  return Object.assign(state, {
    async deriveRenditions(seed: string) {
      state.uploadCount += 1
      return { card: seed, hero: seed, og: seed }
    },
  })
}

function recordingSearchIndex(
  initial: Record<string, CatalogRecord> = {},
): SearchIndex & { saved: CatalogRecord[]; appliedSettings: IndexSettings[] } {
  const store = { ...initial }
  const saved: CatalogRecord[] = []
  const appliedSettings: IndexSettings[] = []
  return {
    saved,
    appliedSettings,
    async getObject(objectID) {
      return store[objectID] ?? null
    },
    async saveObject(record) {
      store[record.objectID] = record
      saved.push(record)
    },
    async deleteObject() {},
    async applySettings(settings) {
      appliedSettings.push(settings)
    },
  }
}

function noopThrottler(): Throttler & { waitCount: number } {
  const state = { waitCount: 0 }
  return Object.assign(state, {
    async wait() {
      state.waitCount += 1
    },
  })
}

describe('reindexAll', () => {
  it('applies index settings once, then walks every page and indexes every document', async () => {
    const contentSource = pagedContentSource([[doc('p1', 'rev-1'), doc('p2', 'rev-1')], [doc('p3', 'rev-1')]])
    const imageStore = countingImageStore()
    const searchIndex = recordingSearchIndex()
    const throttler = noopThrottler()

    const summary = await reindexAll({ contentSource, imageStore, searchIndex, profile, throttler, pageSize: 2 })

    expect(summary).toEqual({ indexed: 3, skipped: 0, failed: 0, failedDocumentIds: [] })
    expect(searchIndex.appliedSettings).toHaveLength(1)
    expect(searchIndex.saved.map((r) => r.objectID).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(throttler.waitCount).toBe(3)
  })

  it('reuses the idempotency check: an already-current document is skipped without re-uploading its image', async () => {
    const current: CatalogRecord = {
      objectID: 'p1',
      revision: 'rev-1',
      slug: 'p1',
      name: 'Name p1',
      description: undefined,
      price: null,
      currency: 'ARS',
      inStock: true,
      category: null,
      images: [],
      attributes: {},
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const contentSource = pagedContentSource([[doc('p1', 'rev-1')]])
    const imageStore = countingImageStore()
    const searchIndex = recordingSearchIndex({ p1: current })
    const throttler = noopThrottler()

    const summary = await reindexAll({ contentSource, imageStore, searchIndex, profile, throttler, pageSize: 10 })

    expect(summary).toEqual({ indexed: 0, skipped: 1, failed: 0, failedDocumentIds: [] })
    expect(imageStore.uploadCount).toBe(0)
  })

  it('continues past a failing document and reports it, instead of aborting the whole run', async () => {
    const contentSource = pagedContentSource([[doc('p1', 'rev-1'), doc('p-broken', 'rev-1'), doc('p3', 'rev-1')]])
    const imageStore: ImageStore = {
      async deriveRenditions(seed, url) {
        if (url.includes('p-broken')) {
          throw new Error('Cloudinary upload failed')
        }
        return { card: seed, hero: seed, og: seed }
      },
    }
    const searchIndex = recordingSearchIndex()
    const throttler = noopThrottler()

    const summary = await reindexAll({ contentSource, imageStore, searchIndex, profile, throttler, pageSize: 10 })

    expect(summary).toEqual({ indexed: 2, skipped: 0, failed: 1, failedDocumentIds: ['p-broken'] })
  })
})
