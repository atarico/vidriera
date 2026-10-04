export interface MessageOutcome {
  messageId: string
  ok: boolean
}

export interface SqsBatchResponse {
  batchItemFailures: { itemIdentifier: string }[]
}

/**
 * Pure: turns per-message outcomes into the SQS partial-batch-failure
 * response. Reporting only the failing ids is deliberate — a whole-batch
 * failure would redrive healthy records into the DLQ alongside the broken
 * one.
 */
export function buildBatchItemFailures(outcomes: MessageOutcome[]): SqsBatchResponse {
  return {
    batchItemFailures: outcomes.filter((outcome) => !outcome.ok).map((outcome) => ({ itemIdentifier: outcome.messageId })),
  }
}
