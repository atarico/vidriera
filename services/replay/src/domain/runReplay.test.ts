import { describe, expect, it } from 'vitest'
import { runReplay } from './runReplay'
import type { DeadLetterSource, MainQueue, ReplayableMessage } from '../ports'

function fakeDlq(messages: ReplayableMessage[]): DeadLetterSource & { removed: string[] } {
  const removed: string[] = []
  return {
    removed,
    async receive(maxMessages) {
      return messages.slice(0, maxMessages)
    },
    async remove(message) {
      removed.push(message.id)
    },
  }
}

function fakeMainQueue(): MainQueue & { sent: Array<{ body: string; replayCount: number }> } {
  const sent: Array<{ body: string; replayCount: number }> = []
  return {
    sent,
    async send(body, replayCount) {
      sent.push({ body, replayCount })
    },
  }
}

describe('runReplay', () => {
  it('redrives a healthy message back to the main queue and removes it from the DLQ', async () => {
    const dlq = fakeDlq([{ id: 'msg-1', body: '{"documentId":"p1"}', replayCount: 0 }])
    const mainQueue = fakeMainQueue()

    const summary = await runReplay({ dlq, mainQueue, maxReplays: 3, maxMessagesPerRun: 10 })

    expect(summary).toEqual({ replayed: 1, parked: 0, parkedMessageIds: [] })
    expect(mainQueue.sent).toEqual([{ body: '{"documentId":"p1"}', replayCount: 1 }])
    expect(dlq.removed).toEqual(['msg-1'])
  })

  it('parks a message past the max replay count instead of redriving it, and leaves it in the DLQ', async () => {
    const dlq = fakeDlq([{ id: 'msg-poison', body: '{"documentId":"bad"}', replayCount: 3 }])
    const mainQueue = fakeMainQueue()

    const summary = await runReplay({ dlq, mainQueue, maxReplays: 3, maxMessagesPerRun: 10 })

    expect(summary).toEqual({ replayed: 0, parked: 1, parkedMessageIds: ['msg-poison'] })
    expect(mainQueue.sent).toEqual([])
    expect(dlq.removed).toEqual([])
  })

  it('processes a mix of healthy and poison messages independently in one run', async () => {
    const dlq = fakeDlq([
      { id: 'msg-1', body: 'a', replayCount: 0 },
      { id: 'msg-poison', body: 'b', replayCount: 5 },
      { id: 'msg-2', body: 'c', replayCount: 1 },
    ])
    const mainQueue = fakeMainQueue()

    const summary = await runReplay({ dlq, mainQueue, maxReplays: 3, maxMessagesPerRun: 10 })

    expect(summary.replayed).toBe(2)
    expect(summary.parkedMessageIds).toEqual(['msg-poison'])
  })

  it('never processes more than maxMessagesPerRun messages, so a run cannot run away', async () => {
    const dlq = fakeDlq(
      Array.from({ length: 50 }, (_, i) => ({ id: `msg-${i}`, body: 'x', replayCount: 0 })),
    )
    const mainQueue = fakeMainQueue()

    const summary = await runReplay({ dlq, mainQueue, maxReplays: 3, maxMessagesPerRun: 5 })

    expect(summary.replayed).toBe(5)
    expect(mainQueue.sent).toHaveLength(5)
  })
})
