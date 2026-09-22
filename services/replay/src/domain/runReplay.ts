import type { DeadLetterSource, MainQueue } from '../ports'
import { decideReplay } from './replayDecision'

export interface RunReplayDeps {
  dlq: DeadLetterSource
  mainQueue: MainQueue
  maxReplays: number
  maxMessagesPerRun: number
}

export interface RunReplaySummary {
  replayed: number
  parked: number
  parkedMessageIds: string[]
}

/**
 * Drains up to maxMessagesPerRun messages from the DLQ (the bounded-run
 * guard) and, for each, either redrives it to the main queue with a bumped
 * replay counter or leaves it in the DLQ for human attention.
 */
export async function runReplay(deps: RunReplayDeps): Promise<RunReplaySummary> {
  const messages = await deps.dlq.receive(deps.maxMessagesPerRun)

  let replayed = 0
  const parkedMessageIds: string[] = []

  for (const message of messages) {
    const decision = decideReplay({ replayCount: message.replayCount, maxReplays: deps.maxReplays })

    if (decision.action === 'replay') {
      await deps.mainQueue.send(message.body, decision.nextReplayCount)
      await deps.dlq.remove(message)
      replayed += 1
    } else {
      parkedMessageIds.push(message.id)
    }
  }

  return { replayed, parked: parkedMessageIds.length, parkedMessageIds }
}
