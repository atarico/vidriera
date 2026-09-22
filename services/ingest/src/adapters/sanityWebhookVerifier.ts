import { decodeSignatureHeader, isValidSignature, SIGNATURE_HEADER_NAME } from '@sanity/webhook'
import type { WebhookSignatureVerifier } from '../ports'

/**
 * WebhookSignatureVerifier adapter over @sanity/webhook.
 *
 * This is the only file in the service allowed to import @sanity/webhook.
 * Sanity signs webhook requests with an HMAC-SHA256 over
 * `${timestampMs}.${rawBody}`, base64url-encoded, carried in the
 * `sanity-webhook-signature` header as `t=<timestampMs>,v1=<signature>`.
 *
 * Residual risk, stated accurately: `isValidSignature()` in the installed
 * `@sanity/webhook@4.0.4` does NOT do a timing-safe comparison. Its dist
 * (`node_modules/@sanity/webhook/dist/index.js`) compares the computed and
 * received signatures with a plain `if (signature !== encoded)`, and the
 * package contains zero references to `timingSafeEqual` anywhere. An
 * earlier version of this comment claimed the opposite; that claim was
 * false and has been corrected.
 *
 * We accept this rather than hand-rolling our own HMAC verification. A
 * remote timing attack against a SHA-256 HMAC digest comparison over HTTP
 * is widely considered impractical in practice: network jitter (typically
 * milliseconds) dwarfs the nanosecond-scale timing signal a `!==`
 * early-exit could leak, and the attacker would need an implausible number
 * of low-noise samples to extract even one byte of the digest. Hand-rolled
 * crypto comparison code is a well-known source of real bugs (off-by-one
 * exits, non-constant-time "constant-time" implementations, etc.), so this
 * trades a theoretical, impractical risk for a real one we are not willing
 * to take on. If this dependency is ever upgraded, re-verify this claim
 * against the new dist rather than assuming it still holds.
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
