import { describe, expect, it } from 'vitest'
import { mapWebhookPayload } from './mapWebhookPayload'

const now = () => '2026-09-22T12:00:00.000Z'

describe('mapWebhookPayload', () => {
  it('maps an upsert payload to an IngestMessage', () => {
    const result = mapWebhookPayload({ documentId: 'product-1', revision: 'rev-1', operation: 'upsert' }, now)

    expect(result).toEqual({
      ok: true,
      message: {
        documentId: 'product-1',
        revision: 'rev-1',
        operation: 'upsert',
        receivedAt: '2026-09-22T12:00:00.000Z',
      },
    })
  })

  it('maps a delete payload to an IngestMessage', () => {
    const result = mapWebhookPayload({ documentId: 'product-1', revision: 'rev-1', operation: 'delete' }, now)

    expect(result).toEqual({
      ok: true,
      message: {
        documentId: 'product-1',
        revision: 'rev-1',
        operation: 'delete',
        receivedAt: '2026-09-22T12:00:00.000Z',
      },
    })
  })

  it('rejects a payload missing documentId', () => {
    const result = mapWebhookPayload({ revision: 'rev-1', operation: 'upsert' }, now)
    expect(result).toEqual({ ok: false, reason: 'Missing or invalid "documentId"' })
  })

  it('rejects a payload missing revision', () => {
    const result = mapWebhookPayload({ documentId: 'product-1', operation: 'upsert' }, now)
    expect(result).toEqual({ ok: false, reason: 'Missing or invalid "revision"' })
  })

  it('rejects a payload with an operation other than upsert or delete', () => {
    const result = mapWebhookPayload({ documentId: 'product-1', revision: 'rev-1', operation: 'archive' }, now)
    expect(result).toEqual({ ok: false, reason: 'Invalid "operation": expected "upsert" or "delete"' })
  })

  it('rejects a non-object payload', () => {
    const result = mapWebhookPayload(null, now)
    expect(result).toEqual({ ok: false, reason: 'Payload must be a JSON object' })
  })
})
