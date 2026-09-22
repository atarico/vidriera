import { copy } from './copy'

export interface WhatsAppOrderLinkInput {
  /** Business WhatsApp number in any human-typed format (spaces, dashes, +, parens allowed). */
  phoneNumber: string
  productName: string
  /** Absolute URL back to the product's detail page. */
  productUrl: string
}

/**
 * Strips everything except digits, per WhatsApp's wa.me link format, which
 * expects the full international number with no leading "+".
 */
export function normalizePhoneNumber(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}

/**
 * Builds a per-product WhatsApp "click to chat" link
 * (https://faq.whatsapp.com/5913398998672934). The message names the
 * product and links back to its page, and is percent-encoded via
 * encodeURIComponent so accents, ampersands and quotes — all expected in a
 * Spanish-language product catalog — never break the query string.
 */
export function buildWhatsAppOrderLink({
  phoneNumber,
  productName,
  productUrl,
}: WhatsAppOrderLinkInput): string {
  const digits = normalizePhoneNumber(phoneNumber)
  const message = copy.whatsapp.orderMessage(productName, productUrl)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
