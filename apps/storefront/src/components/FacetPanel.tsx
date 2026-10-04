import { useRefinementList, useToggleRefinement } from 'react-instantsearch'
import type { FacetConfig } from '../lib/facets'
import { copy } from '../lib/copy'

interface RefinementListFacetProps {
  facet: FacetConfig
}

/**
 * Built on the useRefinementList connector rather than the default
 * <RefinementList> widget so the markup and styling are fully ours (see
 * src/styles/global.css) instead of Algolia's default `ais-*` skin — this
 * is what keeps the result looking like a hand-built storefront rather
 * than an off-the-shelf search widget.
 */
function RefinementListFacet({ facet }: RefinementListFacetProps) {
  const { items, refine, canRefine } = useRefinementList({ attribute: facet.attribute, limit: 8 })

  if (!canRefine) return null

  return (
    <div className="facet-group">
      <p className="facet-group__label">{facet.label}</p>
      <ul className="facet-group__list">
        {items.map((item) => (
          <li key={item.value}>
            <label className="facet-option">
              <input
                type="checkbox"
                checked={item.isRefined}
                onChange={() => refine(item.value)}
              />
              <span>{item.label}</span>
              <span className="facet-option__count">({item.count})</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ToggleFacetProps {
  facet: FacetConfig
}

function ToggleFacet({ facet }: ToggleFacetProps) {
  const { value, refine } = useToggleRefinement({ attribute: facet.attribute, on: true })

  return (
    <label className="facet-toggle">
      <span>{facet.label === copy.facets.inStock ? copy.facets.inStockOnly : facet.label}</span>
      <input
        type="checkbox"
        checked={value.isRefined}
        onChange={(event) => refine({ isRefined: !event.target.checked })}
      />
    </label>
  )
}

export interface FacetPanelProps {
  facets: FacetConfig[]
}

/**
 * The entire filter UI is generated from `facets`, which is derived from
 * `attributesForFaceting(activeRubroProfile)` (see src/lib/facets.ts). No
 * facet name is hardcoded here — swapping the rubro profile changes this
 * list, and this component renders whatever it is given.
 */
export function FacetPanel({ facets }: FacetPanelProps) {
  return (
    <nav className="facet-panel" aria-label={copy.facets.category}>
      {facets.map((facet) =>
        facet.kind === 'toggle' ? (
          <ToggleFacet key={facet.attribute} facet={facet} />
        ) : (
          <RefinementListFacet key={facet.attribute} facet={facet} />
        ),
      )}
    </nav>
  )
}
