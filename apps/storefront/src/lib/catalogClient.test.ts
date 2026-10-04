import { describe, expect, it } from 'vitest'
import type { CatalogRecord } from '@vidriera/contracts'
import { fetchAllCatalogRecords, readAlgoliaEnvConfig } from './catalogClient'
import type { SearchClientPort } from './catalogClient'

function record(objectID: string): CatalogRecord {
  return {
    objectID,
    revision: 'rev-1',
    slug: objectID,
    name: `Product ${objectID}`,
    price: 100,
    currency: 'ARS',
    inStock: true,
    category: 'general',
    images: [],
    attributes: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('readAlgoliaEnvConfig', () => {
  it('returns a config object when every required variable is present', () => {
    const config = readAlgoliaEnvConfig({
      PUBLIC_ALGOLIA_APP_ID: 'app123',
      PUBLIC_ALGOLIA_SEARCH_API_KEY: 'key456',
      PUBLIC_ALGOLIA_INDEX_NAME: 'catalog',
    })
    expect(config).toEqual({ appId: 'app123', searchApiKey: 'key456', indexName: 'catalog' })
  })

  it('returns null when any required variable is missing, so the build can degrade gracefully', () => {
    expect(
      readAlgoliaEnvConfig({
        PUBLIC_ALGOLIA_APP_ID: 'app123',
        PUBLIC_ALGOLIA_SEARCH_API_KEY: undefined,
        PUBLIC_ALGOLIA_INDEX_NAME: 'catalog',
      }),
    ).toBeNull()
  })

  it('returns null when all are missing', () => {
    expect(readAlgoliaEnvConfig({})).toBeNull()
  })
})

describe('fetchAllCatalogRecords', () => {
  it('aggregates hits across every page the search client reports', async () => {
    const pages: CatalogRecord[][] = [[record('a'), record('b')], [record('c')]]
    const fakeClient: SearchClientPort = {
      async search(methodParams) {
        const req = methodParams.requests[0]
        const page = req?.page ?? 0
        const hits = pages[page] ?? []
        return { results: [{ hits, nbPages: pages.length }] }
      },
    }

    const records = await fetchAllCatalogRecords(fakeClient, 'catalog')
    expect(records.map((r) => r.objectID)).toEqual(['a', 'b', 'c'])
  })

  it('sends flat search parameters, as the Algolia v5 client requires', async () => {
    // v5 takes params either flat on the request or as a URL-encoded string.
    // A nested params object is rejected by the API: "Expecting a string".
    const requests: unknown[] = []
    const fakeClient: SearchClientPort = {
      async search(methodParams) {
        requests.push(...methodParams.requests)
        return { results: [{ hits: [], nbPages: 0 }] }
      },
    }

    await fetchAllCatalogRecords(fakeClient, 'catalog')

    expect(requests).toEqual([{ indexName: 'catalog', query: '', hitsPerPage: 1000, page: 0 }])
  })

  it('returns an empty array when the index has no records, without throwing', async () => {
    const fakeClient: SearchClientPort = {
      async search() {
        return { results: [{ hits: [], nbPages: 0 }] }
      },
    }
    expect(await fetchAllCatalogRecords(fakeClient, 'catalog')).toEqual([])
  })

  it('stops after a single page when nbPages is 1, without an extra request', async () => {
    let callCount = 0
    const fakeClient: SearchClientPort = {
      async search() {
        callCount += 1
        return { results: [{ hits: [record('only')], nbPages: 1 }] }
      },
    }
    const records = await fetchAllCatalogRecords(fakeClient, 'catalog')
    expect(records.map((r) => r.objectID)).toEqual(['only'])
    expect(callCount).toBe(1)
  })
})
