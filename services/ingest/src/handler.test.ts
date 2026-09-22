import type { APIGatewayProxyEventV2 } from 'aws-lambda'
import { describe, expect, it } from 'vitest'
import type { IngestMessage } from '@vidriera/contracts'
import { createHandler } from './handler'
import type { IngestQueue, WebhookSignatureVerifier } from './ports'

const NOW_MS = 1_758_542_400_000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

function fakeVerifier(overrides: Partial<{ isValid: boolean; timestampMs: number | null }> = {}): WebhookSignatureVerifier {
  return {
    headerName: 'sanity-webhook-signature',
    async verify() {
      return { isValid: overrides.isValid ?? true, timestampMs: overrides.timestampMs ?? NOW_MS }
    },
  }
}

function fakeQueue(): IngestQueue & { enqueued: IngestMessage[] } {
  const enqueued: IngestMessage[] = []
  return {
    enqueued,
    async enqueue(message) {
      enqueued.push(message)
    },
  }
}

function buildEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: 'POST /webhook',
    rawPath: '/webhook',
    rawQueryString: '',
    headers: { 'sanity-webhook-signature': 't=1758542400000,v1=fake' },
    requestContext: {} as APIGatewayProxyEventV2['requestContext'],
    body: JSON.stringify({ documentId: 'product-1', revision: 'rev-1', operation: 'upsert' }),
    isBase64Encoded: false,
    ...overrides,
  }
}

describe('ingest handler', () => {
  it('enqueues a valid, well-signed request and responds 202 quickly', async () => {
    const queue = fakeQueue()
    const handler = createHandler({
      verifier: fakeVerifier(),
      queue,
      now: () => new Date(NOW_MS).toISOString(),
      nowMs: () => NOW_MS,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })

    const response = await handler(buildEvent())

    expect(response.statusCode).toBe(202)
    expect(queue.enqueued).toEqual([
      { documentId: 'product-1', revision: 'rev-1', operation: 'upsert', receivedAt: new Date(NOW_MS).toISOString() },
    ])
  })

  it('rejects with 401 and does not enqueue when the signature is invalid', async () => {
    const queue = fakeQueue()
    const handler = createHandler({
      verifier: fakeVerifier({ isValid: false, timestampMs: null }),
      queue,
      now: () => new Date(NOW_MS).toISOString(),
      nowMs: () => NOW_MS,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })

    const response = await handler(buildEvent())

    expect(response.statusCode).toBe(401)
    expect(queue.enqueued).toEqual([])
  })

  it('rejects with 400 and does not enqueue when the signature header is absent', async () => {
    const queue = fakeQueue()
    const handler = createHandler({
      verifier: fakeVerifier(),
      queue,
      now: () => new Date(NOW_MS).toISOString(),
      nowMs: () => NOW_MS,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })

    const response = await handler(buildEvent({ headers: {} }))

    expect(response.statusCode).toBe(400)
    expect(queue.enqueued).toEqual([])
  })

  it('rejects with 401 and does not enqueue a replayed (stale) timestamp', async () => {
    const queue = fakeQueue()
    const handler = createHandler({
      verifier: fakeVerifier({ timestampMs: NOW_MS - MAX_CLOCK_SKEW_MS - 1 }),
      queue,
      now: () => new Date(NOW_MS).toISOString(),
      nowMs: () => NOW_MS,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })

    const response = await handler(buildEvent())

    expect(response.statusCode).toBe(401)
    expect(queue.enqueued).toEqual([])
  })

  it('rejects with 400 and does not enqueue a payload that fails mapping', async () => {
    const queue = fakeQueue()
    const handler = createHandler({
      verifier: fakeVerifier(),
      queue,
      now: () => new Date(NOW_MS).toISOString(),
      nowMs: () => NOW_MS,
      maxClockSkewMs: MAX_CLOCK_SKEW_MS,
    })

    const response = await handler(buildEvent({ body: JSON.stringify({ operation: 'upsert' }) }))

    expect(response.statusCode).toBe(400)
    expect(queue.enqueued).toEqual([])
  })
})
