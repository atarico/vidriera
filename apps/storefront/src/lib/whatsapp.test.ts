import { describe, expect, it } from 'vitest'
import { buildWhatsAppOrderLink, normalizePhoneNumber } from './whatsapp'

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
})
