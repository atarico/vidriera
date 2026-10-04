import type { IngestMessage } from '@vidriera/contracts'

/**
 * Port for verifying the Sanity webhook HMAC signature. Owned by the
 * domain; implemented by the sanityWebhookVerifier adapter, the only file
 * in this service allowed to import @sanity/webhook.
 */
export interface WebhookSignatureVerifier {
  /** The HTTP header name this verifier expects the signature in. */
  readonly headerName: string
  /**
   * Verifies rawBody against signatureHeader. Returns isValid: false and
   * timestampMs: null for a missing, malformed, or cryptographically
   * invalid signature — never throws for those cases.
   */
  verify(
    rawBody: string,
    signatureHeader: string | undefined,
  ): Promise<{ isValid: boolean; timestampMs: number | null }>
}

/** Port for enqueuing an accepted IngestMessage. */
export interface IngestQueue {
  enqueue(message: IngestMessage): Promise<void>
}
