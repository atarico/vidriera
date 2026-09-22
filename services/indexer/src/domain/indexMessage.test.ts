import { describe, expect, it } from 'vitest'
import type { CatalogRecord, IngestMessage, RubroProfile } from '@vidriera/contracts'
import type { ContentSource, ImageStore, SearchIndex, SourceDocument } from '@vidriera/catalog-core'
import { indexMessage } from './indexMessage'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [{ name: 'brand', title: 'Brand', type: 'string', facet: true, searchable: true }],
}

function fakeContentSource(documents: Record<string, SourceDocument | undefined>): ContentSource {
  return {
    async getDocument(documentId) {
      return documents[documentId] ?? null
    },
    async listDocuments() {
      return { documents: [], nextCursor: undefined }
    },
  }
}

function fakeImageStore(): ImageStore & { uploadCount: number; seeds: string[] } {
  const state = { uploadCount: 0, seeds: [] as string[] }
  return Object.assign(state, {
    async deriveRenditions(publicIdSeed: string) {
      state.uploadCount += 1
      state.seeds.push(publicIdSeed)
      return { card: `card/${publicIdSeed}`, hero: `hero/${publicIdSeed}`, og: `og/${publicIdSeed}` }
    },
  })
}

function fakeSearchIndex(initial: Record<string, CatalogRecord> = {}): SearchIndex & { saved: CatalogRecord[]; deleted: string[] } {
  const store = { ...initial }
  const saved: CatalogRecord[] = []
  const deleted: string[] = []
  return {
    saved,
    deleted,
    async getObject(objectID) {
      return store[objectID] ?? null
    },
    async saveObject(record) {
      store[record.objectID] = record
      saved.push(record)
    },
    async deleteObject(objectID) {
      delete store[objectID]
      deleted.push(objectID)
    },
    async applySettings() {},
  }
}

const doc: SourceDocument = {
  _id: 'product-1',
  _rev: 'rev-1',
  slug: 'product-1',
  name: 'Product One',
  currency: 'ARS',
  inStock: true,
  attributes: { brand: 'Acme' },
  updatedAt: '2026-01-01T00:00:00.000Z',
  imageSourceUrls: ['https://source/1.jpg'],
}

const upsertMessage: IngestMessage = {
  documentId: 'product-1',
  revision: 'rev-1',
  operation: 'upsert',
  receivedAt: '2026-09-22T12:00:00.000Z',
}

describe('indexMessage', () => {
  it('fetches the document, derives images and saves a new CatalogRecord for a first-time upsert', async () => {
    const contentSource = fakeContentSource({ 'product-1': doc })
    const imageStore = fakeImageStore()
    const searchIndex = fakeSearchIndex()

    const outcome = await indexMessage(upsertMessage, { contentSource, imageStore, searchIndex, profile })

    expect(outcome).toEqual({ status: 'indexed', objectID: 'product-1' })
    expect(searchIndex.saved).toHaveLength(1)
    expect(searchIndex.saved[0]).toMatchObject({ objectID: 'product-1', revision: 'rev-1', attributes: { brand: 'Acme' } })
    expect(imageStore.uploadCount).toBe(1)
  })

  it('is idempotent: replaying the same revision skips both the image upload and the Algolia write', async () => {
    const indexedRecord: CatalogRecord = {
      objectID: 'product-1',
      revision: 'rev-1',
      slug: 'product-1',
      name: 'Product One',
      description: undefined,
      price: null,
      currency: 'ARS',
      inStock: true,
      category: null,
      images: [{ card: 'card/product-1-0', hero: 'hero/product-1-0', og: 'og/product-1-0' }],
      attributes: { brand: 'Acme' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const contentSource = fakeContentSource({ 'product-1': doc })
    const imageStore = fakeImageStore()
    const searchIndex = fakeSearchIndex({ 'product-1': indexedRecord })

    const outcome = await indexMessage(upsertMessage, { contentSource, imageStore, searchIndex, profile })

    expect(outcome).toEqual({ status: 'skipped', objectID: 'product-1' })
    expect(searchIndex.saved).toHaveLength(0)
    expect(imageStore.uploadCount).toBe(0)
  })

  it('deletes the record for a delete message without fetching the document', async () => {
    const contentSource = fakeContentSource({})
    const imageStore = fakeImageStore()
    const searchIndex = fakeSearchIndex()

    const outcome = await indexMessage(
      { ...upsertMessage, operation: 'delete' },
      { contentSource, imageStore, searchIndex, profile },
    )

    expect(outcome).toEqual({ status: 'deleted', objectID: 'product-1' })
    expect(searchIndex.deleted).toEqual(['product-1'])
    expect(imageStore.uploadCount).toBe(0)
  })

  it('treats an upsert for a document that no longer exists in Sanity as a delete', async () => {
    const contentSource = fakeContentSource({})
    const imageStore = fakeImageStore()
    const searchIndex = fakeSearchIndex()

    const outcome = await indexMessage(upsertMessage, { contentSource, imageStore, searchIndex, profile })

    expect(outcome).toEqual({ status: 'deleted', objectID: 'product-1' })
    expect(searchIndex.deleted).toEqual(['product-1'])
  })

  it('re-indexes when the document has a new revision, uploading images again', async () => {
    const indexedRecord: CatalogRecord = {
      objectID: 'product-1',
      revision: 'rev-0-old',
      slug: 'product-1',
      name: 'Product One (old)',
      description: undefined,
      price: null,
      currency: 'ARS',
      inStock: true,
      category: null,
      images: [],
      attributes: {},
      updatedAt: '2025-01-01T00:00:00.000Z',
    }
    const contentSource = fakeContentSource({ 'product-1': doc })
    const imageStore = fakeImageStore()
    const searchIndex = fakeSearchIndex({ 'product-1': indexedRecord })

    const outcome = await indexMessage(upsertMessage, { contentSource, imageStore, searchIndex, profile })

    expect(outcome).toEqual({ status: 'indexed', objectID: 'product-1' })
    expect(searchIndex.saved).toHaveLength(1)
    expect(searchIndex.saved[0]?.revision).toBe('rev-1')
    expect(imageStore.uploadCount).toBe(1)
  })
})
