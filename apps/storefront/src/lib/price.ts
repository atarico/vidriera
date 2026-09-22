import { copy } from './copy'

/**
 * Formats a CatalogRecord price for display. `price: null` is a valid,
 * common state (the shop owner didn't set one) and gets neutral
 * "price on request" copy rather than a blank or "0".
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return copy.product.priceUnavailable

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price)
}
