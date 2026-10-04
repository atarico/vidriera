import { genericRubroProfile } from '@vidriera/contracts'
import { categorySchema } from './category'
import { buildProductSchema } from './product'

/**
 * The full Studio schema. "product" is generated from the active rubro
 * profile (see @vidriera/contracts/src/rubro.ts — the single swap point).
 */
export const schemaTypes = [buildProductSchema(genericRubroProfile), categorySchema]
