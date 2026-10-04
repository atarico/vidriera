import type { IngestMessage } from '@vidriera/contracts'

/**
 * Pure mapping from a decoded Sanity webhook JSON body to an IngestMessage.
 *
 * The webhook is configured (see docs/environment.md, Terraform webhook
 * setup) with a GROQ projection that already emits documentId/revision/
 * operation directly:
 *
 *   {
 *     "documentId": coalesce(after()._id, before()._id),
 *     "revision": coalesce(after()._rev, before()._rev),
 *     "operation": select(after() == null => "delete", "upsert")
 *   }
 *
 * This function only validates and normalizes that shape — it never infers
 * upsert/delete itself, since Sanity's before()/after() already resolved
 * that transition at webhook-delivery time.
 */
export type MapWebhookPayloadResult = { ok: true; message: IngestMessage } | { ok: false; reason: string }

export function mapWebhookPayload(payload: unknown, now: () => string): MapWebhookPayloadResult {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'Payload must be a JSON object' }
  }

  const record = payload as Record<string, unknown>

  if (typeof record.documentId !== 'string' || record.documentId.length === 0) {
    return { ok: false, reason: 'Missing or invalid "documentId"' }
  }

  if (typeof record.revision !== 'string' || record.revision.length === 0) {
    return { ok: false, reason: 'Missing or invalid "revision"' }
  }

  if (record.operation !== 'upsert' && record.operation !== 'delete') {
    return { ok: false, reason: 'Invalid "operation": expected "upsert" or "delete"' }
  }

  return {
    ok: true,
    message: {
      documentId: record.documentId,
      revision: record.revision,
      operation: record.operation,
      receivedAt: now(),
    },
  }
}
