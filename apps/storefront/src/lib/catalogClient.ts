import type { CatalogRecord } from '@vidriera/contracts'

export interface AlgoliaEnvConfig {
  appId: string
  searchApiKey: string
  indexName: string
}

/**
 * Reads the three PUBLIC_-prefixed Algolia variables this app needs.
 * Deliberately shaped as a loose record rather than ImportMetaEnv so it can
 * be called both from browser code (import.meta.env) and from build-time
 * code (getStaticPaths), and unit tested with a plain object.
 *
 * Returns null — never throws — when anything is missing, so both the
 * search island and the static build can degrade gracefully (see
 * SearchExperience.tsx's "not configured" state and
 * pages/productos/[slug].astro's empty getStaticPaths) instead of crashing
 * before real Algolia credentials exist.
 */
export function readAlgoliaEnvConfig(
  env: Partial<Record<string, string | undefined>>,
): AlgoliaEnvConfig | null {
  const appId = env.PUBLIC_ALGOLIA_APP_ID
  const searchApiKey = env.PUBLIC_ALGOLIA_SEARCH_API_KEY
  const indexName = env.PUBLIC_ALGOLIA_INDEX_NAME

  if (!appId || !searchApiKey || !indexName) return null

  return { appId, searchApiKey, indexName }
}

/**
 * The slice of the Algolia v5 client's `search` method this module depends
 * on (see https://www.algolia.com/doc/api-reference/api-methods/search/).
 * Modeling it as a narrow port, rather than importing the vendor SDK type
 * directly, keeps fetchAllCatalogRecords unit-testable with a fake and
 * matches this repo's existing hexagonal style (see
 * packages/catalog-core/src/ports.ts).
 *
 * v5 search parameters sit flat on each request; `params` only accepts a
 * URL-encoded string, and the API rejects a nested object with "Expecting a
 * string". The vendor types cannot catch that: a request carrying an extra
 * `params` object still matches their flat-parameters variant. The request
 * shape is pinned by catalogClient.test.ts instead.
 */
export interface SearchClientPort {
  search(methodParams: {
    requests: Array<{ indexName: string; query?: string; hitsPerPage?: number; page?: number }>
  }): Promise<{ results: Array<{ hits: CatalogRecord[]; nbPages: number }> }>
}

/** Algolia's hard cap on hitsPerPage. */
const MAX_HITS_PER_PAGE = 1000

/**
 * Fetches every record in the index by paginating the `search` endpoint
 * with an empty query, rather than using Algolia's dedicated `browse`
 * endpoint. This is deliberate: `browse` requires the `browse` ACL, while
 * an empty-query `search` only requires the `search` ACL — the same
 * search-only key the browser uses. One credential, one ACL, everywhere in
 * this app.
 */
export async function fetchAllCatalogRecords(
  client: SearchClientPort,
  indexName: string,
): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = []
  let page = 0
  let nbPages = 1

  do {
    const response = await client.search({
      requests: [{ indexName, query: '', hitsPerPage: MAX_HITS_PER_PAGE, page }],
    })
    const result = response.results[0]
    if (!result) break

    records.push(...result.hits)
    nbPages = result.nbPages
    page += 1
  } while (page < nbPages)

  return records
}
