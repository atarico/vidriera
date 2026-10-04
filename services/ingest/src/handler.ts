import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { createSanityWebhookVerifier } from './adapters/sanityWebhookVerifier'
import { createSqsIngestQueue } from './adapters/sqsIngestQueue'
import { evaluateWebhookRequest } from './domain/evaluateWebhookRequest'
import { mapWebhookPayload } from './domain/mapWebhookPayload'
import type { IngestQueue, WebhookSignatureVerifier } from './ports'

const DEFAULT_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

export interface HandlerDependencies {
  verifier: WebhookSignatureVerifier
  queue: IngestQueue
  now: () => string
  nowMs: () => number
  maxClockSkewMs: number
}

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// The response body only reaches the webhook sender, so log every rejection
// too. Status and reason only: never the body or the signature header.
function reject(statusCode: number, reason: string): APIGatewayProxyStructuredResultV2 {
  console.error(`Rejecting webhook (${statusCode}): ${reason}`)
  return jsonResponse(statusCode, { message: reason })
}

/**
 * Thin Lambda handler: parses the event, delegates the accept/reject and
 * mapping decisions to pure domain functions, and calls the queue port.
 * Targets a Lambda Function URL / API Gateway HTTP API payload format 2.0.
 */
export function createHandler(deps: HandlerDependencies) {
  return async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    const rawBody = event.isBase64Encoded && event.body ? Buffer.from(event.body, 'base64').toString('utf8') : (event.body ?? '')

    const headers = event.headers ?? {}
    const signatureHeader = headers[deps.verifier.headerName]

    const { isValid, timestampMs } = await deps.verifier.verify(rawBody, signatureHeader)

    const decision = evaluateWebhookRequest({
      signatureHeader,
      isSignatureValid: isValid,
      signatureTimestampMs: timestampMs,
      nowMs: deps.nowMs(),
      maxClockSkewMs: deps.maxClockSkewMs,
    })

    if (!decision.accepted) {
      return reject(decision.statusCode, decision.reason)
    }

    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      return reject(400, 'Request body is not valid JSON')
    }

    const mapped = mapWebhookPayload(parsedBody, deps.now)
    if (!mapped.ok) {
      return reject(400, mapped.reason)
    }

    await deps.queue.enqueue(mapped.message)

    // 202: accepted for asynchronous processing. The webhook sender must
    // not wait on indexing.
    return jsonResponse(202, { accepted: true })
  }
}

function buildDependenciesFromEnv(): HandlerDependencies {
  const secret = process.env.SANITY_WEBHOOK_SECRET
  const queueUrl = process.env.INGEST_QUEUE_URL
  if (!secret) {
    throw new Error('SANITY_WEBHOOK_SECRET is not set')
  }
  if (!queueUrl) {
    throw new Error('INGEST_QUEUE_URL is not set')
  }

  const maxClockSkewMs = process.env.WEBHOOK_MAX_CLOCK_SKEW_MS
    ? Number(process.env.WEBHOOK_MAX_CLOCK_SKEW_MS)
    : DEFAULT_MAX_CLOCK_SKEW_MS

  return {
    verifier: createSanityWebhookVerifier(secret),
    queue: createSqsIngestQueue(queueUrl),
    now: () => new Date().toISOString(),
    nowMs: () => Date.now(),
    maxClockSkewMs,
  }
}

// Lazily built on first invocation (not at module load) so importing
// createHandler for tests never requires env vars to be set. Once built, it
// is memoized for the lifetime of the execution environment, matching the
// AWS SDK v3 guidance to construct clients once and reuse them.
let cachedHandler: ReturnType<typeof createHandler> | undefined

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  if (!cachedHandler) {
    cachedHandler = createHandler(buildDependenciesFromEnv())
  }
  return cachedHandler(event)
}
