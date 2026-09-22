/**
 * Pure accept/reject decision for an incoming webhook request.
 *
 * Signature *validity* (HMAC match) and *timestamp extraction* are computed
 * by the adapter, since they require the @sanity/webhook package's crypto.
 * This function only makes the decision: is the request signed, valid, and
 * fresh enough to not be a replay?
 */
export interface EvaluateWebhookRequestInput {
  signatureHeader: string | undefined
  isSignatureValid: boolean
  signatureTimestampMs: number | null
  nowMs: number
  maxClockSkewMs: number
}

export type EvaluateWebhookRequestResult =
  | { accepted: true }
  | { accepted: false; statusCode: 400 | 401; reason: string }

export function evaluateWebhookRequest(input: EvaluateWebhookRequestInput): EvaluateWebhookRequestResult {
  const { signatureHeader, isSignatureValid, signatureTimestampMs, nowMs, maxClockSkewMs } = input

  if (!signatureHeader) {
    return { accepted: false, statusCode: 400, reason: 'Missing signature header' }
  }

  if (!isSignatureValid || signatureTimestampMs === null) {
    return { accepted: false, statusCode: 401, reason: 'Invalid signature' }
  }

  const age = Math.abs(nowMs - signatureTimestampMs)
  if (age > maxClockSkewMs) {
    return {
      accepted: false,
      statusCode: 401,
      reason: 'Signature timestamp outside allowed window (possible replay)',
    }
  }

  return { accepted: true }
}
