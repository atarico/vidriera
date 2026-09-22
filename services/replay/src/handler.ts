import { createSqsDeadLetterSource, createSqsMainQueue } from './adapters/sqsDlqAdapter'
import { runReplay } from './domain/runReplay'
import type { RunReplaySummary } from './domain/runReplay'
import type { DeadLetterSource, MainQueue } from './ports'

const DEFAULT_MAX_REPLAYS = 5
const DEFAULT_MAX_MESSAGES_PER_RUN = 100

export interface HandlerDependencies {
  dlq: DeadLetterSource
  mainQueue: MainQueue
  maxReplays: number
  maxMessagesPerRun: number
}

/**
 * Thin Lambda handler for a manual or EventBridge-scheduled trigger: run
 * the bounded replay drain and surface any parked (poison) messages for
 * human attention via the logs.
 */
export function createHandler(deps: HandlerDependencies) {
  return async (): Promise<RunReplaySummary> => {
    const summary = await runReplay(deps)
    if (summary.parked > 0) {
      console.error(
        `${summary.parked} message(s) parked after exceeding ${deps.maxReplays} replay attempts and left in the DLQ for human attention: ${summary.parkedMessageIds.join(', ')}`,
      )
    }
    return summary
  }
}

let cachedHandler: ReturnType<typeof createHandler> | undefined

export const handler = async (): Promise<RunReplaySummary> => {
  if (!cachedHandler) {
    cachedHandler = createHandler(buildDependenciesFromEnv())
  }
  return cachedHandler()
}

function buildDependenciesFromEnv(): HandlerDependencies {
  const dlqUrl = requireEnv('DLQ_URL')
  const mainQueueUrl = requireEnv('MAIN_QUEUE_URL')
  const maxReplays = process.env.REPLAY_MAX_ATTEMPTS ? Number(process.env.REPLAY_MAX_ATTEMPTS) : DEFAULT_MAX_REPLAYS
  const maxMessagesPerRun = process.env.REPLAY_MAX_MESSAGES_PER_RUN
    ? Number(process.env.REPLAY_MAX_MESSAGES_PER_RUN)
    : DEFAULT_MAX_MESSAGES_PER_RUN

  return {
    dlq: createSqsDeadLetterSource(dlqUrl),
    mainQueue: createSqsMainQueue(mainQueueUrl),
    maxReplays,
    maxMessagesPerRun,
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}
