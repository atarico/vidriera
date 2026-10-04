import { describe, expect, it } from 'vitest'
import { parseIngestMessage } from './parseIngestMessage'

describe('parseIngestMessage', () => {
  it('parses a well-formed IngestMessage JSON body', () => {
    const body = JSON.stringify({
      documentId: 'product-1',
      revision: 'rev-1',
      operation: 'upsert',
      receivedAt: '2026-09-22T12:00:00.000Z',
    })

    expect(parseIngestMessage(body)).toEqual({
      ok: true,
      message: {
        documentId: 'product-1',
        revision: 'rev-1',
        operation: 'upsert',
        receivedAt: '2026-09-22T12:00:00.000Z',
      },
    })
  })

  it('rejects a body that is not valid JSON', () => {
    expect(parseIngestMessage('not json')).toEqual({ ok: false, reason: 'Body is not valid JSON' })
  })

  it('rejects a body missing required fields', () => {
    expect(parseIngestMessage(JSON.stringify({ documentId: 'product-1' }))).toEqual({
      ok: false,
      reason: 'Missing or invalid "revision"',
    })
  })

  it('rejects a body with an invalid operation', () => {
    const body = JSON.stringify({
      documentId: 'product-1',
      revision: 'rev-1',
      operation: 'archive',
      receivedAt: '2026-09-22T12:00:00.000Z',
    })
    expect(parseIngestMessage(body)).toEqual({
      ok: false,
      reason: 'Invalid "operation": expected "upsert" or "delete"',
    })
  })
})
