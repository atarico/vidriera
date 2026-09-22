import { useHits, useInstantSearch } from 'react-instantsearch'
import type { CatalogRecord } from '@vidriera/contracts'
import { ProductHitCard } from './ProductHitCard'
import { copy } from '../lib/copy'

/**
 * Renders the loading / error / empty / results states for the search
 * results area. `status` and `error` come straight from useInstantSearch
 * (react-instantsearch-core), confirmed against its published source
 * rather than assumed.
 */
export function ResultsGrid() {
  const { status, error, results } = useInstantSearch({ catchError: true })
  const { hits } = useHits<CatalogRecord>()

  if (error) {
    return (
      <div className="state-banner state-banner--error" role="alert">
        {copy.states.error}
      </div>
    )
  }

  if (status === 'loading' && hits.length === 0) {
    return (
      <div className="state-banner" role="status">
        {copy.states.loading}
      </div>
    )
  }

  if (results && results.nbHits === 0) {
    return (
      <div className="state-banner" role="status">
        <p>{copy.states.empty}</p>
        <p>{copy.states.emptyHint}</p>
      </div>
    )
  }

  return (
    <ul className="results-grid">
      {hits.map((hit) => (
        <li key={hit.objectID}>
          <ProductHitCard hit={hit} />
        </li>
      ))}
    </ul>
  )
}
