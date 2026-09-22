import { liteClient } from 'algoliasearch/lite'
import type { LiteClient } from 'algoliasearch/lite'
import type { AlgoliaEnvConfig } from './catalogClient'

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
