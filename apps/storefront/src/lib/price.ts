import { copy } from './copy'

/**
 * Formats a CatalogRecord price for display. `price: null` is a valid,
 * common state (the shop owner didn't set one) and gets neutral
 * "price on request" copy rather than a blank or "0".
 *
 * Must never throw: `currency` is untrusted CMS content, and a throw here
 * fails the static build or breaks the whole search result list.
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return copy.product.priceUnavailable

  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: String(currency).trim().toUpperCase(),
      maximumFractionDigits: 0,
    }).format(price)
  } catch {
    return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(price)
  }
}
