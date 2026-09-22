import { useSearchBox } from 'react-instantsearch'
import { copy } from '../lib/copy'

export function SearchField() {
  const { query, refine } = useSearchBox()

  return (
    <div className="search-field">
      <label htmlFor="storefront-search" className="visually-hidden">
        {copy.search.placeholder}
      </label>
      <input
        id="storefront-search"
        type="search"
        className="search-field__input"
        placeholder={copy.search.placeholder}
        defaultValue={query}
        onChange={(event) => refine(event.currentTarget.value)}
      />
    </div>
  )
}
