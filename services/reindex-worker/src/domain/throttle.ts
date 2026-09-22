/**
 * Pure: how long to wait before the next operation, given when the last
 * one happened, the current time, and the minimum interval between
 * operations. Returns 0 for the very first operation.
 */
export function computeThrottleDelayMs(lastOperationAtMs: number | null, nowMs: number, minIntervalMs: number): number {
  if (lastOperationAtMs === null) {
    return 0
  }
  const elapsed = nowMs - lastOperationAtMs
  return Math.max(0, minIntervalMs - elapsed)
}

/**
 * Clock is injected so pacing is testable without a real timer: `sleep`
 * never calls setTimeout in a test, and `now` never calls Date.now().
 */
export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export interface Throttler {
  /** Waits as long as needed to respect the minimum interval, then records the operation time. */
  wait(): Promise<void>
}

/**
 * Deliberate pacing against Algolia's rate limits — this (plus the >15min
 * runtime of a full catalog) is why the reindex job runs on ECS Fargate
 * rather than Lambda.
 */
export function createThrottler(minIntervalMs: number, clock: Clock): Throttler {
  let lastOperationAtMs: number | null = null

  return {
    async wait() {
      const delay = computeThrottleDelayMs(lastOperationAtMs, clock.now(), minIntervalMs)
      if (delay > 0) {
        await clock.sleep(delay)
      }
      lastOperationAtMs = clock.now()
    },
  }
}

/** The real clock, used only at the process entry point — never in a test. */
export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}
