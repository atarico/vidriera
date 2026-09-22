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

const HIGH_SURROGATE_MIN = 0xd800
const HIGH_SURROGATE_MAX = 0xdbff
const LOW_SURROGATE_MIN = 0xdc00
const LOW_SURROGATE_MAX = 0xdfff

/**
 * Removes any UTF-16 surrogate code unit that is not part of a valid
 * high+low surrogate pair, leaving valid pairs (e.g. real emoji) untouched.
 *
 * Why this exists: `encodeURIComponent` throws `URIError: URI malformed`
 * when it encounters a lone surrogate. Product names come from Sanity
 * content and can pick one up from a bad paste, a mangled import, or an
 * encoding glitch. Since [slug].astro is prerendered at build time
 * (`output: 'static'`), an uncaught throw here does not just break one
 * product page — it fails the entire `astro build`. A shop owner typing an
 * actual emoji into a product name must keep working, so this strips only
 * unpaired surrogates, never a valid pair.
 */
export function sanitizeSurrogates(text: string): string {
  let result = ''

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)

    if (code >= HIGH_SURROGATE_MIN && code <= HIGH_SURROGATE_MAX) {
      const nextCode = text.charCodeAt(i + 1)
      if (nextCode >= LOW_SURROGATE_MIN && nextCode <= LOW_SURROGATE_MAX) {
        result += text.slice(i, i + 2) // the matched high+low surrogate pair
        i++ // consume the matched low surrogate too
      }
      // else: lone high surrogate, dropped
      continue
    }

    if (code >= LOW_SURROGATE_MIN && code <= LOW_SURROGATE_MAX) {
      // A low surrogate reaching here was never preceded by a matching high
      // surrogate (that case is consumed above), so it is lone. Dropped.
      continue
    }

    result += text[i]
  }

  return result
}

/**
 * Builds a per-product WhatsApp "click to chat" link
 * (https://faq.whatsapp.com/5913398998672934). The message names the
 * product and links back to its page, and is percent-encoded via
 * encodeURIComponent so accents, ampersands and quotes — all expected in a
 * Spanish-language product catalog — never break the query string.
 *
 * The product name is run through sanitizeSurrogates() first: it is
 * untrusted content (Sanity) and encodeURIComponent throws on a lone
 * surrogate, which would otherwise fail the entire static build (see that
 * function's doc comment).
 */
export function buildWhatsAppOrderLink({
  phoneNumber,
  productName,
  productUrl,
}: WhatsAppOrderLinkInput): string {
  const digits = normalizePhoneNumber(phoneNumber)
  const safeProductName = sanitizeSurrogates(productName)
  const message = copy.whatsapp.orderMessage(safeProductName, productUrl)
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
