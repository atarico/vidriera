import type { IngestMessage } from '@vidriera/contracts'

export type ParseIngestMessageResult = { ok: true; message: IngestMessage } | { ok: false; reason: string }

/** Pure: parses and validates an SQS record body into an IngestMessage. */
export function parseIngestMessage(rawBody: string): ParseIngestMessageResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return { ok: false, reason: 'Body is not valid JSON' }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'Body must be a JSON object' }
  }

  const record = parsed as Record<string, unknown>

  if (typeof record.documentId !== 'string' || record.documentId.length === 0) {
    return { ok: false, reason: 'Missing or invalid "documentId"' }
  }
  if (typeof record.revision !== 'string' || record.revision.length === 0) {
    return { ok: false, reason: 'Missing or invalid "revision"' }
  }
  if (record.operation !== 'upsert' && record.operation !== 'delete') {
    return { ok: false, reason: 'Invalid "operation": expected "upsert" or "delete"' }
  }
  if (typeof record.receivedAt !== 'string' || record.receivedAt.length === 0) {
    return { ok: false, reason: 'Missing or invalid "receivedAt"' }
  }

  return {
    ok: true,
    message: {
      documentId: record.documentId,
      revision: record.revision,
      operation: record.operation,
      receivedAt: record.receivedAt,
    },
  }
}
