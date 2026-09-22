import { describe, expect, it } from 'vitest'
import { validateProfile } from './derivation'
import { genericRubroProfile } from './rubro'

describe('genericRubroProfile', () => {
  it('is a valid RubroProfile', () => {
    expect(validateProfile(genericRubroProfile)).toEqual([])
  })

  it('is deliberately generic: no options list tied to a specific vertical', () => {
    for (const attribute of genericRubroProfile.attributes) {
      expect(attribute.options).toBeUndefined()
    }
  })
})
