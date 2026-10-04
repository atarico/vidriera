import { describe, expect, it } from 'vitest'
import { buildBatchItemFailures } from './buildBatchItemFailures'

describe('buildBatchItemFailures', () => {
  it('reports no failures when every message succeeded', () => {
    const result = buildBatchItemFailures([
      { messageId: 'msg-1', ok: true },
      { messageId: 'msg-2', ok: true },
    ])
    expect(result).toEqual({ batchItemFailures: [] })
  })

  it('reports only the failing message id, so healthy records in the same batch are not redriven', () => {
    const result = buildBatchItemFailures([
      { messageId: 'msg-1', ok: true },
      { messageId: 'msg-2', ok: false },
      { messageId: 'msg-3', ok: true },
    ])
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-2' }] })
  })

  it('reports every failing id, in order, when multiple messages fail', () => {
    const result = buildBatchItemFailures([
      { messageId: 'msg-1', ok: false },
      { messageId: 'msg-2', ok: true },
      { messageId: 'msg-3', ok: false },
    ])
    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: 'msg-1' }, { itemIdentifier: 'msg-3' }] })
  })
})
