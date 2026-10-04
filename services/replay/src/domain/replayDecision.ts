export interface ReplayDecisionInput {
  replayCount: number
  maxReplays: number
}

export type ReplayDecision = { action: 'replay'; nextReplayCount: number } | { action: 'park'; reason: string }

/**
 * Pure poison-message guard: should this DLQ message be redriven, or
 * parked for human attention? A message that has already been replayed
 * maxReplays times is parked instead of redriven again, so a permanently
 * broken record cannot ping-pong between the main queue and the DLQ
 * forever.
 */
export function decideReplay(input: ReplayDecisionInput): ReplayDecision {
  if (input.replayCount >= input.maxReplays) {
    return { action: 'park', reason: `Exceeded max replay attempts (${input.maxReplays})` }
  }
  return { action: 'replay', nextReplayCount: input.replayCount + 1 }
}
