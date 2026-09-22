import { describe, expect, it } from 'vitest'
import { evaluateWebhookRequest } from './evaluateWebhookRequest'

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

describe('evaluateWebhookRequest', () => {
  it('rejects with 400 when the signature header is missing', () => {
    const result = evaluateWebhookRequest({
      signatureHeader: undefined,
      isSignatureValid: false,
      signatureTimestampMs: null,
      nowMs: 1_758_542_400_000,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })
    expect(result).toEqual({ accepted: false, statusCode: 400, reason: 'Missing signature header' })
  })

  it('rejects with 401 when the signature is invalid', () => {
    const result = evaluateWebhookRequest({
      signatureHeader: 't=1758542400000,v1=bad',
      isSignatureValid: false,
      signatureTimestampMs: 1_758_542_400_000,
      nowMs: 1_758_542_400_000,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })
    expect(result).toEqual({ accepted: false, statusCode: 401, reason: 'Invalid signature' })
  })

  it('rejects with 401 when the signed timestamp is older than the allowed clock skew (replay)', () => {
    const nowMs = 1_758_542_400_000
    const result = evaluateWebhookRequest({
      signatureHeader: 't=1758542000000,v1=good',
      isSignatureValid: true,
      signatureTimestampMs: nowMs - MAX_CLOCK_SKEW_MS - 1,
      nowMs,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })
    expect(result).toEqual({ accepted: false, statusCode: 401, reason: 'Signature timestamp outside allowed window (possible replay)' })
  })

  it('rejects with 401 when the signed timestamp is in the future beyond the allowed clock skew', () => {
    const nowMs = 1_758_542_400_000
    const result = evaluateWebhookRequest({
      signatureHeader: 't=1758542900000,v1=good',
      isSignatureValid: true,
      signatureTimestampMs: nowMs + MAX_CLOCK_SKEW_MS + 1,
      nowMs,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })
    expect(result).toMatchObject({ accepted: false, statusCode: 401 })
  })

  it('accepts a validly signed, fresh request exactly at the skew boundary', () => {
    const nowMs = 1_758_542_400_000
    const result = evaluateWebhookRequest({
      signatureHeader: 't=1758542100000,v1=good',
      isSignatureValid: true,
      signatureTimestampMs: nowMs - MAX_CLOCK_SKEW_MS,
      nowMs,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })
    expect(result).toEqual({ accepted: true })
  })
})
