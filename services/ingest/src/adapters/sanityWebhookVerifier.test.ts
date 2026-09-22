import { encodeSignatureHeader } from '@sanity/webhook'
import { describe, expect, it } from 'vitest'
import { createSanityWebhookVerifier } from './sanityWebhookVerifier'

const secret = 'test-secret'

describe('createSanityWebhookVerifier', () => {
  it('exposes the exact header name Sanity signs with', () => {
    const verifier = createSanityWebhookVerifier(secret)
    expect(verifier.headerName).toBe('sanity-webhook-signature')
  })

  it('validates a correctly signed payload and decodes its timestamp', async () => {
    const verifier = createSanityWebhookVerifier(secret)
    const body = JSON.stringify({ documentId: 'product-1', revision: 'rev-1', operation: 'upsert' })
    const timestampMs = 1_758_542_400_000
    const header = await encodeSignatureHeader(body, timestampMs, secret)

    const result = await verifier.verify(body, header)

    expect(result).toEqual({ isValid: true, timestampMs })
  })

  it('rejects a signature computed with the wrong secret', async () => {
    const verifier = createSanityWebhookVerifier(secret)
    const body = JSON.stringify({ documentId: 'product-1', revision: 'rev-1', operation: 'upsert' })
    const header = await encodeSignatureHeader(body, 1_758_542_400_000, 'wrong-secret')

    const result = await verifier.verify(body, header)

    expect(result.isValid).toBe(false)
  })

  it('rejects a signature whose body was tampered with after signing', async () => {
    const verifier = createSanityWebhookVerifier(secret)
    const signedBody = JSON.stringify({ documentId: 'product-1', revision: 'rev-1', operation: 'upsert' })
    const header = await encodeSignatureHeader(signedBody, 1_758_542_400_000, secret)
    const tamperedBody = JSON.stringify({ documentId: 'product-1', revision: 'rev-EVIL', operation: 'upsert' })

    const result = await verifier.verify(tamperedBody, header)

    expect(result.isValid).toBe(false)
  })

  it('returns isValid: false and timestampMs: null for a missing header', async () => {
    const verifier = createSanityWebhookVerifier(secret)
    const result = await verifier.verify('{}', undefined)
    expect(result).toEqual({ isValid: false, timestampMs: null })
  })

  it('returns isValid: false and timestampMs: null for a malformed header, without throwing', async () => {
    const verifier = createSanityWebhookVerifier(secret)
    const result = await verifier.verify('{}', 'not-a-signature-header')
    expect(result).toEqual({ isValid: false, timestampMs: null })
  })
})
