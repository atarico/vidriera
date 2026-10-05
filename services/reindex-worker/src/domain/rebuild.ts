import type { RebuildTrigger } from '@vidriera/catalog-core'
import type { ReindexSummary } from './run'

/**
 * Asks for a storefront rebuild after a reindex, only when something was
 * actually written. Failures are contained here: the reindex already
 * succeeded or failed on its own terms, and a flaky rebuild request must
 * not change the task's exit code.
 */
export async function triggerRebuildAfterReindex(
  summary: ReindexSummary,
  trigger: RebuildTrigger,
  log: Pick<Console, 'error'> = console,
): Promise<void> {
  if (summary.indexed === 0) {
    return
  }

  try {
    await trigger.trigger(`full reindex wrote ${summary.indexed} document(s)`)
  } catch (error) {
    log.error(
      `Storefront rebuild trigger failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
