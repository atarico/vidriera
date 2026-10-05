import { describe, expect, it } from 'vitest'
import type { RebuildTrigger } from '@vidriera/catalog-core'
import { triggerRebuildAfterReindex } from './rebuild'

function recordingTrigger(): { trigger: RebuildTrigger; reasons: string[] } {
  const reasons: string[] = []
  return {
    reasons,
    trigger: {
      async trigger(reason) {
        reasons.push(reason)
      },
    },
  }
}

const silentLog = { error() {} }

describe('triggerRebuildAfterReindex', () => {
  it('triggers once when at least one document was indexed', async () => {
    const { trigger, reasons } = recordingTrigger()

    await triggerRebuildAfterReindex(
      { indexed: 3, skipped: 1, failed: 0, failedDocumentIds: [] },
      trigger,
      silentLog,
    )

    expect(reasons).toHaveLength(1)
  })

  it('still triggers when some documents failed but others were indexed', async () => {
    const { trigger, reasons } = recordingTrigger()

    await triggerRebuildAfterReindex(
      { indexed: 1, skipped: 0, failed: 2, failedDocumentIds: ['a', 'b'] },
      trigger,
      silentLog,
    )

    expect(reasons).toHaveLength(1)
  })

  it('does not trigger when nothing was indexed', async () => {
    const { trigger, reasons } = recordingTrigger()

    await triggerRebuildAfterReindex(
      { indexed: 0, skipped: 5, failed: 0, failedDocumentIds: [] },
      trigger,
      silentLog,
    )

    expect(reasons).toEqual([])
  })

  it('contains a failing trigger: logs the message and does not throw', async () => {
    const logged: string[] = []
    const failing: RebuildTrigger = {
      async trigger() {
        throw new Error('GitHub dispatch failed with status 500')
      },
    }

    await expect(
      triggerRebuildAfterReindex(
        { indexed: 1, skipped: 0, failed: 0, failedDocumentIds: [] },
        failing,
        {
          error: (message) => logged.push(String(message)),
        },
      ),
    ).resolves.toBeUndefined()

    expect(logged).toHaveLength(1)
    expect(logged[0]).toContain('GitHub dispatch failed with status 500')
  })
})
