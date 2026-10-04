import { liteClient } from 'algoliasearch/lite'
import type { LiteClient } from 'algoliasearch/lite'
import type { CatalogRecord } from '@vidriera/contracts'
import type { AlgoliaEnvConfig, SearchClientPort } from './catalogClient'

/**
 * The only file in this app allowed to import `algoliasearch/lite`. Used
 * both by the React search island (browser, as InstantSearch's
 * `searchClient` prop) and by pages/productos/[slug].astro's
 * getStaticPaths (build-time Node, structurally satisfying
 * catalogClient.ts's SearchClientPort), always with the
 * PUBLIC_ALGOLIA_SEARCH_API_KEY. The "lite" build ships only the search
 * client code (no index-management surface at all), which both keeps the
 * browser bundle small and makes an admin operation structurally
 * unreachable from this module, on top of the env-name guard in
 * envGuard.ts.
 */
export function createSearchClient(config: AlgoliaEnvConfig): LiteClient {
  return liteClient(config.appId, config.searchApiKey)
}

/**
 * The build-time client for getStaticPaths. Returning it as the port here,
 * in a .ts file, is what makes tsc check the real client against
 * SearchClientPort: `pnpm typecheck` does not type-check .astro files.
 */
export function createCatalogSearchClient(config: AlgoliaEnvConfig): SearchClientPort {
  const client = createSearchClient(config)
  return {
    search: async ({ requests }) => {
      const response = await client.search<CatalogRecord>({ requests })
      return {
        results: response.results.map((result) => {
          // Only hit queries are sent, so a facet response means a contract break.
          if (!('hits' in result)) throw new Error('Expected a hits response from Algolia, got facet values')
          return { hits: result.hits, nbPages: result.nbPages ?? 0 }
        }),
      }
    },
  }
}
