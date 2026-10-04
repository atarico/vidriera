import { algoliasearch } from 'algoliasearch'
import type { CatalogRecord } from '@vidriera/contracts'
import type { SearchIndex } from '../ports'

/** Pure: recognizes the v5 client's 404 ApiError shape without importing it. */
export function isAlgoliaNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && (error as { status?: unknown }).status === 404
}

export interface AlgoliaConfig {
  appId: string
  apiKey: string
  indexName: string
}

/**
 * SearchIndex adapter over the Algolia v5 JS client. The only file allowed
 * to import `algoliasearch` in this repository.
 */
export function createAlgoliaSearchIndex(config: AlgoliaConfig): SearchIndex {
  const client = algoliasearch(config.appId, config.apiKey)
  const { indexName } = config

  return {
    async getObject(objectID) {
      try {
        return await client.getObject<CatalogRecord>({ indexName, objectID })
      } catch (error) {
        if (isAlgoliaNotFoundError(error)) {
          return null
        }
        throw error
      }
    },
    async saveObject(record) {
      await client.saveObject({ indexName, body: record })
    },
    async deleteObject(objectID) {
      await client.deleteObject({ indexName, objectID })
    },
    async applySettings(settings) {
      await client.setSettings({ indexName, indexSettings: settings })
    },
  }
}
