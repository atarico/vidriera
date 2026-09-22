import { attributesForFaceting, searchableAttributes } from '@vidriera/contracts'
import type { RubroProfile } from '@vidriera/contracts'
import type { IndexSettings } from './ports'

/**
 * Builds the Algolia index settings for a rubro profile, using the
 * contracts package's own derivation functions as the single source of
 * truth for which attributes are searchable/facetable.
 */
export function buildIndexSettings(profile: RubroProfile): IndexSettings {
  return {
    searchableAttributes: searchableAttributes(profile),
    attributesForFaceting: attributesForFaceting(profile),
  }
}
