import { attributesForFaceting } from '@vidriera/contracts'
import type { RubroProfile } from '@vidriera/contracts'
import { copy } from './copy'

export type FacetKind = 'refinementList' | 'toggle'

export interface FacetConfig {
  attribute: string
  label: string
  kind: FacetKind
}

const CORE_FACET_LABELS: Record<string, string> = {
  category: copy.facets.category,
  inStock: copy.facets.inStock,
}

/**
 * This is the payoff of the whole rubro-profile architecture: the facet UI
 * is entirely DERIVED from `attributesForFaceting(profile)` — the same pure
 * function the Algolia index settings are built from in
 * packages/catalog-core. Nothing here hardcodes a vertical-specific
 * attribute name. Swap `src/lib/rubroProfile.ts` to a different profile and
 * this function returns a different facet set with no other file changed.
 */
export function buildFacetConfig(profile: RubroProfile): FacetConfig[] {
  const attributeNames = attributesForFaceting(profile)
  const definitionsByName = new Map(profile.attributes.map((a) => [a.name, a]))

  return attributeNames.map((attribute) => {
    if (attribute === 'inStock') {
      return { attribute, label: CORE_FACET_LABELS.inStock ?? attribute, kind: 'toggle' }
    }

    const definition = definitionsByName.get(attribute)
    const label = definition?.title ?? CORE_FACET_LABELS[attribute] ?? attribute
    const kind: FacetKind = definition?.type === 'boolean' ? 'toggle' : 'refinementList'

    return { attribute, label, kind }
  })
}
