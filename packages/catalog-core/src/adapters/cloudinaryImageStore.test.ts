import { describe, expect, it } from 'vitest'
import { buildRenditionUrls } from './cloudinaryImageStore'

describe('buildRenditionUrls', () => {
  it('builds card, hero, og and lqip URLs from an injected URL builder, one call per rendition', () => {
    const calls: Array<[string, unknown]> = []
    const urlFor = (publicId: string, options: unknown) => {
      calls.push([publicId, options])
      return `https://res.cloudinary.com/demo/image/upload/x/${publicId}`
    }

    const renditions = buildRenditionUrls('products/product-1-0', urlFor)

    expect(renditions.card).toBe('https://res.cloudinary.com/demo/image/upload/x/products/product-1-0')
    expect(renditions.hero).toBe('https://res.cloudinary.com/demo/image/upload/x/products/product-1-0')
    expect(renditions.og).toBe('https://res.cloudinary.com/demo/image/upload/x/products/product-1-0')
    expect(renditions.lqip).toBe('https://res.cloudinary.com/demo/image/upload/x/products/product-1-0')
    expect(calls).toHaveLength(4)
    expect(calls.every(([publicId]) => publicId === 'products/product-1-0')).toBe(true)
  })

  it('requests distinct crop dimensions per rendition', () => {
    const seenDimensions: Array<{ width?: number; height?: number }> = []
    const urlFor = (_publicId: string, options: { width?: number; height?: number }) => {
      seenDimensions.push({ width: options.width, height: options.height })
      return 'url'
    }

    buildRenditionUrls('seed', urlFor)

    const unique = new Set(seenDimensions.map((d) => `${d.width}x${d.height}`))
    expect(unique.size).toBe(4)
  })
})
