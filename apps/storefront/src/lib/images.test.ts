import { describe, expect, it } from 'vitest'
import type { ImageRenditions } from '@vidriera/contracts'
import { pickRendition, primaryImage } from './images'

const image: ImageRenditions = {
  card: 'https://cdn.example.com/card.jpg',
  hero: 'https://cdn.example.com/hero.jpg',
  og: 'https://cdn.example.com/og.jpg',
}

describe('primaryImage', () => {
  it('returns the first image when present', () => {
    expect(primaryImage([image])).toBe(image)
  })

  it('returns undefined for an empty list instead of throwing', () => {
    expect(primaryImage([])).toBeUndefined()
  })
})

describe('pickRendition', () => {
  it('returns the requested rendition URL from the primary image', () => {
    expect(pickRendition([image], 'hero')).toBe('https://cdn.example.com/hero.jpg')
    expect(pickRendition([image], 'card')).toBe('https://cdn.example.com/card.jpg')
    expect(pickRendition([image], 'og')).toBe('https://cdn.example.com/og.jpg')
  })

  it('returns undefined when there are no images', () => {
    expect(pickRendition([], 'hero')).toBeUndefined()
  })
})
