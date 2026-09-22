import type { SQSEvent, SQSRecord } from 'aws-lambda'
import { describe, expect, it } from 'vitest'
import type { CatalogRecord, RubroProfile } from '@vidriera/contracts'
import type { ContentSource, ImageStore, SearchIndex, SourceDocument } from '@vidriera/catalog-core'
import { createHandler } from './handler'

const profile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [],
}

function sqsRecord(messageId: string, body: unknown): SQSRecord {
  return {
    messageId,
    body: JSON.stringify(body),
    receiptHandle: `receipt-${messageId}`,
    attributes: {} as SQSRecord['attributes'],
    messageAttributes: {},
    md5OfBody: '',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:ingest',
    awsRegion: 'us-east-1',
  }
}

function doc(id: string, rev: string): SourceDocument {
  return {
    _id: id,
    _rev: rev,
    slug: id,
    name: `Name ${id}`,
    currency: 'ARS',
    inStock: true,
    attributes: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
    imageSourceUrls: [],
  }
}

describe('indexer handler', () => {
  it('reports only the failing message id when one record errors, leaving healthy records out of batchItemFailures', async () => {
    const contentSource: ContentSource = {
      async getDocument(documentId) {
        if (documentId === 'product-broken') {
          throw new Error('Sanity is down')
        }
        return doc(documentId, 'rev-1')
      },
      async listDocuments() {
        return { documents: [], nextCursor: undefined }
      },
    }
    const imageStore: ImageStore = {
      async deriveRenditions(seed) {
        return { card: `card/${seed}`, hero: `hero/${seed}`, og: `og/${seed}` }
      },
    }
    const saved: CatalogRecord[] = []
    const searchIndex: SearchIndex = {
      async getObject() {
        return null
      },
      async saveObject(record) {
        saved.push(record)
      },
      async deleteObject() {},
      async applySettings() {},
    }

    const handler = createHandler({ contentSource, imageStore, searchIndex, profile })

    const event: SQSEvent = {
      Records: [
        sqsRecord('msg-1', { documentId: 'product-1', revision: 'rev-1', operation: 'upsert', receivedAt: 'x' }),
        sqsRecord('msg-2', { documentId: 'product-broken', revision: 'rev-1', operation: 'upsert', receivedAt: 'x' }),
        sqsRecord('msg-3', { documentId: 'product-3', revision: 'rev-1', operation: 'upsert', receivedAt: 'x' }),
      ],
    }

    const result = await handler(event)

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-2' }] })
    expect(saved.map((r) => r.objectID).sort()).toEqual(['product-1', 'product-3'])
  })

  it('reports a message id whose body fails to parse as a batch item failure', async () => {
    const contentSource: ContentSource = {
      async getDocument() {
        return null
      },
      async listDocuments() {
        return { documents: [], nextCursor: undefined }
      },
    }
    const imageStore: ImageStore = {
      async deriveRenditions(seed) {
        return { card: seed, hero: seed, og: seed }
      },
    }
    const searchIndex: SearchIndex = {
      async getObject() {
        return null
      },
      async saveObject() {},
      async deleteObject() {},
      async applySettings() {},
    }

    const handler = createHandler({ contentSource, imageStore, searchIndex, profile })
    const event: SQSEvent = { Records: [{ ...sqsRecord('msg-bad', {}), body: 'not json' }] }

    const result = await handler(event)

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-bad' }] })
  })
})
