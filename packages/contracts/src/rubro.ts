import type { RubroProfile } from './types'

/**
 * ============================================================================
 *  SINGLE SWAP POINT FOR THE VERTICAL ("RUBRO")
 * ============================================================================
 *
 * This is the ONLY file in the repository that may describe vertical-specific
 * (rubro-specific) fields and facets. Everything downstream — the Sanity
 * Studio schema, the Algolia index settings, the storefront filters — is
 * derived from this profile via the pure functions in ./derivation.
 *
 * The rubro is not known yet. This is a deliberately generic PLACEHOLDER
 * profile so the rest of the platform (Studio, ingest, indexer, storefront)
 * can be built and tested end-to-end today. When the real vertical is known,
 * replace the contents of this file — and only this file — with the actual
 * attribute set. No other package should need to change.
 * ============================================================================
 */
export const genericRubroProfile: RubroProfile = {
  id: 'generic',
  title: 'Generic Catalog',
  productNoun: { singular: 'product', plural: 'products' },
  attributes: [
    {
      name: 'brand',
      title: 'Brand',
      type: 'string',
      facet: true,
      searchable: true,
    },
    {
      name: 'tags',
      title: 'Tags',
      type: 'stringList',
      facet: true,
    },
  ],
}
