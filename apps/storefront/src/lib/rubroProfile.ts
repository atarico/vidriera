import { genericRubroProfile } from '@vidriera/contracts'
import type { RubroProfile } from '@vidriera/contracts'

/**
 * The storefront's single import of the active rubro profile. This file
 * exists only so every page/island has one obvious place to import the
 * active profile from — the profile's actual FIELDS live in exactly one
 * place, packages/contracts/src/rubro.ts, per that package's own contract.
 * When the real vertical is known, only packages/contracts/src/rubro.ts
 * changes; this file keeps re-exporting whatever it exports.
 */
export const activeRubroProfile: RubroProfile = genericRubroProfile
