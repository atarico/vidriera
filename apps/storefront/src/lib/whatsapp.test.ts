import { describe, expect, it } from 'vitest'
import { buildWhatsAppOrderLink, normalizePhoneNumber, sanitizeSurrogates } from './whatsapp'

describe('normalizePhoneNumber', () => {
  it('strips spaces, dashes, parens and a leading plus', () => {
    expect(normalizePhoneNumber('+54 9 11 2233-4455')).toBe('5491122334455')
  })

  it('leaves an already-digits-only number untouched', () => {
    expect(normalizePhoneNumber('5491122334455')).toBe('5491122334455')
  })
})

describe('buildWhatsAppOrderLink', () => {
  it('builds a wa.me link with the normalized phone number', () => {
    const link = buildWhatsAppOrderLink({
      phoneNumber: '+54 9 11 2233-4455',
      productName: 'Silla de madera',
      productUrl: 'https://tienda.example.com/productos/silla-de-madera',
    })
    expect(link.startsWith('https://wa.me/5491122334455?text=')).toBe(true)
  })

  it('URL-encodes accented characters, ampersands and quotes in the message', () => {
    const link = buildWhatsAppOrderLink({
      phoneNumber: '5491122334455',
      productName: 'Ñoquis & Salsa "especial"',
      productUrl: 'https://tienda.example.com/productos/noquis',
    })

    // The raw special characters must never appear unencoded in the URL.
    const [, encodedText] = link.split('?text=')
    expect(encodedText).toBeDefined()
    expect(encodedText).not.toContain('&Salsa') // a raw & would start a new query param
    expect(encodedText).not.toContain('"')
    expect(encodedText).not.toContain('Ñ')

    // And it must decode back to exactly the intended message.
    const decoded = decodeURIComponent(encodedText as string)
    expect(decoded).toBe(
      'Hola, quiero consultar por "Ñoquis & Salsa "especial"". https://tienda.example.com/productos/noquis',
    )
  })

  it('names the product and links back to its page in the message body', () => {
    const link = buildWhatsAppOrderLink({
      phoneNumber: '5491122334455',
      productName: 'Maceta de barro',
      productUrl: 'https://tienda.example.com/productos/maceta-de-barro',
    })
    const decoded = decodeURIComponent(link.split('?text=')[1] as string)
    expect(decoded).toContain('Maceta de barro')
    expect(decoded).toContain('https://tienda.example.com/productos/maceta-de-barro')
  })

  it('produces a URL with no raw whitespace (fully percent-encoded query value)', () => {
    const link = buildWhatsAppOrderLink({
      phoneNumber: '5491122334455',
      productName: 'Taza de cerámica',
      productUrl: 'https://tienda.example.com/productos/taza',
    })
    const encodedText = link.split('?text=')[1] as string
    expect(encodedText).not.toContain(' ')
  })

  // Defect: a product name carrying a lone UTF-16 surrogate (e.g. from a bad
  // paste, a mangled import, or an encoding glitch in Sanity) made
  // encodeURIComponent throw `URIError: URI malformed`. Since this page is
  // prerendered at build time (output: 'static'), that throw took down the
  // ENTIRE astro build, not just the one broken product. See
  // src/pages/productos/[slug].astro, which calls this function unguarded.
  it('does not throw on a product name containing a lone (unpaired) surrogate', () => {
    const brokenName = 'Broken\uD800Name' // lone high surrogate, no matching low surrogate
    expect(() =>
      buildWhatsAppOrderLink({
        phoneNumber: '5491122334455',
        productName: brokenName,
        productUrl: 'https://tienda.example.com/productos/broken',
      }),
    ).not.toThrow()
  })

  it('keeps a valid surrogate pair (real emoji) intact in the message', () => {
    const nameWithEmoji = 'Maceta 🌱 de barro' // 🌱 = 🌱, a valid pair
    const link = buildWhatsAppOrderLink({
      phoneNumber: '5491122334455',
      productName: nameWithEmoji,
      productUrl: 'https://tienda.example.com/productos/maceta',
    })
    const decoded = decodeURIComponent(link.split('?text=')[1] as string)
    expect(decoded).toContain(nameWithEmoji)
  })

  it('strips a lone surrogate from the message instead of silently corrupting nearby text', () => {
    const brokenName = 'Broken\uD800Name'
    const link = buildWhatsAppOrderLink({
      phoneNumber: '5491122334455',
      productName: brokenName,
      productUrl: 'https://tienda.example.com/productos/broken',
    })
    const decoded = decodeURIComponent(link.split('?text=')[1] as string)
    expect(decoded).toContain('BrokenName')
    expect(decoded).not.toContain('\uD800')
  })

  // Proves the property that actually protects `astro build`: this function
  // must never throw for ANY string input, since [slug].astro calls it
  // unconditionally with `record.name` sourced from Sanity content.
  it('never throws for any malformed-surrogate product name (the whole-build guarantee)', () => {
    const malformedNames = [
      '\uD800', // lone high surrogate alone
      '\uDC00', // lone low surrogate alone
      'A\uD800\uD800B', // two consecutive lone high surrogates
      '\uDFFFStart', // lone low surrogate at the start
      'End\uD900', // lone high surrogate at the end
    ]
    for (const productName of malformedNames) {
      expect(() =>
        buildWhatsAppOrderLink({
          phoneNumber: '5491122334455',
          productName,
          productUrl: 'https://tienda.example.com/productos/x',
        }),
      ).not.toThrow()
    }
  })
})

describe('sanitizeSurrogates', () => {
  it('leaves a string with no surrogates untouched', () => {
    expect(sanitizeSurrogates('Silla de madera')).toBe('Silla de madera')
  })

  it('keeps a valid surrogate pair (emoji) intact', () => {
    expect(sanitizeSurrogates('Planta 🌱')).toBe('Planta 🌱')
  })

  it('drops a lone high surrogate not followed by a low surrogate', () => {
    expect(sanitizeSurrogates('Broken\uD800Name')).toBe('BrokenName')
  })

  it('drops a lone low surrogate not preceded by a high surrogate', () => {
    expect(sanitizeSurrogates('Broken\uDC00Name')).toBe('BrokenName')
  })
})
