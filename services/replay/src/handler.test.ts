import { describe, expect, it } from 'vitest'
import { createHandler } from './handler'
import type { DeadLetterSource, MainQueue } from './ports'

describe('replay handler', () => {
  it('runs the bounded replay and returns the summary, logging when messages are parked', async () => {
    const dlq: DeadLetterSource & { removed: string[] } = {
      removed: [],
      async receive() {
        return [
          { id: 'msg-1', body: 'a', replayCount: 0 },
          { id: 'msg-poison', body: 'b', replayCount: 5 },
        ]
      },
      async remove(message) {
        this.removed.push(message.id)
      },
    }
    const mainQueue: MainQueue & { sent: unknown[] } = {
      sent: [],
      async send(body, replayCount) {
        this.sent.push({ body, replayCount })
      },
    }

    const handler = createHandler({ dlq, mainQueue, maxReplays: 3, maxMessagesPerRun: 10 })
    const summary = await handler()

    expect(summary).toEqual({ replayed: 1, parked: 1, parkedMessageIds: ['msg-poison'] })
    expect(mainQueue.sent).toEqual([{ body: 'a', replayCount: 1 }])
    expect(dlq.removed).toEqual(['msg-1'])
  })
})
