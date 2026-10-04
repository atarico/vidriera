import { describe, expect, it } from 'vitest'
import { formatPrice } from './price'

describe('formatPrice', () => {
  it('shows the neutral "price on request" copy when price is null', () => {
    expect(formatPrice(null, 'ARS')).toBe('Precio a consultar')
  })

  it('formats a numeric price with its currency, with no decimal noise for whole pesos', () => {
    const formatted = formatPrice(15000, 'ARS')
    expect(formatted).toMatch(/15/)
    expect(formatted).toMatch(/000/)
    expect(formatted).not.toContain('undefined')
    expect(formatted).not.toContain('NaN')
  })

  it('never throws for a zero price', () => {
    expect(() => formatPrice(0, 'ARS')).not.toThrow()
  })

  it('formats lowercase and whitespace-padded currency codes like the uppercase code', () => {
    expect(formatPrice(1500, ' ars ')).toBe(formatPrice(1500, 'ARS'))
  })

  it.each(['', '   ', 'pesos', 'ARSS', undefined, null, 42])(
    'falls back to a plain grouped number without throwing for invalid currency %j',
    (currency) => {
      const formatted = formatPrice(1500, currency as unknown as string)
      expect(formatted).toBe('1.500')
    },
  )
})
