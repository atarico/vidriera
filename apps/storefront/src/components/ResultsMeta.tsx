import { useClearRefinements, useInstantSearch } from 'react-instantsearch'
import { copy } from '../lib/copy'

export function ResultsMeta() {
  const { results } = useInstantSearch()
  const { canRefine, refine } = useClearRefinements()

  if (!results) return null

  return (
    <div className="results-meta">
      <span>{copy.search.resultsCount(results.nbHits)}</span>
      {canRefine ? (
        <button type="button" className="clear-filters" onClick={() => refine()}>
          {copy.search.clearFilters}
        </button>
      ) : null}
    </div>
  )
}
