import { useMemo } from 'react'
import { InstantSearch } from 'react-instantsearch'
import { createSearchClient } from '../lib/algoliaClient'
import { readAlgoliaEnvConfig } from '../lib/catalogClient'
import { activeRubroProfile } from '../lib/rubroProfile'
import { buildFacetConfig } from '../lib/facets'
import { copy } from '../lib/copy'
import { FacetPanel } from '../components/FacetPanel'
import { SearchField } from '../components/SearchField'
import { ResultsMeta } from '../components/ResultsMeta'
import { ResultsGrid } from '../components/ResultsGrid'

// Read once at module scope: import.meta.env.PUBLIC_* is inlined at build
// time by Vite, so this never changes at runtime and never touches
// anything but the three PUBLIC_ Algolia variables (see src/env.d.ts).
const algoliaEnvConfig = readAlgoliaEnvConfig(import.meta.env)
const facets = buildFacetConfig(activeRubroProfile)

/**
 * The one React island in the storefront (client:load, see
 * src/pages/index.astro). Everything else in the site is static Astro
 * output with zero client JS.
 */
export default function SearchExperience() {
  // No credentials yet (this repo ships before any Algolia account exists,
  // see odd/tasks/catalog-platform.md "Blocked on user"): render a plain
  // notice instead of constructing a client with an empty key and letting
  // every request fail.
  if (!algoliaEnvConfig) {
    return (
      <div className="state-banner" role="status">
        {copy.states.notConfigured}
      </div>
    )
  }

  return (
    <SearchExperienceReady
      appId={algoliaEnvConfig.appId}
      searchApiKey={algoliaEnvConfig.searchApiKey}
      indexName={algoliaEnvConfig.indexName}
    />
  )
}

interface SearchExperienceReadyProps {
  appId: string
  searchApiKey: string
  indexName: string
}

function SearchExperienceReady({ appId, searchApiKey, indexName }: SearchExperienceReadyProps) {
  const searchClient = useMemo(
    () => createSearchClient({ appId, searchApiKey, indexName }),
    [appId, searchApiKey, indexName],
  )

  return (
    <InstantSearch
      searchClient={searchClient}
      indexName={indexName}
      future={{ preserveSharedStateOnUnmount: true }}
    >
      <div className="search-shell">
        <aside>
          <FacetPanel facets={facets} />
        </aside>
        <main>
          <SearchField />
          <ResultsMeta />
          <ResultsGrid />
        </main>
      </div>
    </InstantSearch>
  )
}
