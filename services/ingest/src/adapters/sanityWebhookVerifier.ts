import { decodeSignatureHeader, isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import type { WebhookSignatureVerifier } from '../ports'

/**
 * WebhookSignatureVerifier adapter over @sanity/webhook.
 *
 * This is the only file in the service allowed to import @sanity/webhook.
 * Sanity signs webhook requests with an HMAC-SHA256 over
 * `${timestampMs}.${rawBody}`, base64url-encoded, carried in the
 * `sanity-webhook-signature` header as `t=<timestampMs>,v1=<signature>`.
 * The package's isValidSignature() performs a timing-safe comparison
 * internally (via the Web Crypto API); we never compare signatures by hand.
 */
export function createSanityWebhookVerifier(secret: string): WebhookSignatureVerifier {
  return {
    headerName: SIGNATURE_HEADER_NAME,
    async verify(rawBody, signatureHeader) {
      if (!signatureHeader) {
        return { isValid: false, timestampMs: null }
      }

      let timestampMs: number | null
      try {
        timestampMs = decodeSignatureHeader(signatureHeader).timestamp
      } catch {
        return { isValid: false, timestampMs: null }
      }

      const isValid = await isValidSignature(rawBody, signatureHeader, secret)
      return { isValid, timestampMs: isValid ? timestampMs : null }
    },
  }
}
