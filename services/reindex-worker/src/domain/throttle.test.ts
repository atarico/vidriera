import { describe, expect, it } from 'vitest'
import { computeThrottleDelayMs, createThrottler } from './throttle'
import type { Clock } from './throttle'

describe('computeThrottleDelayMs', () => {
  it('never waits before the very first operation', () => {
    expect(computeThrottleDelayMs(null, 1_000, 200)).toBe(0)
  })

  it('waits the remaining time when less than minIntervalMs has elapsed', () => {
    expect(computeThrottleDelayMs(1_000, 1_050, 200)).toBe(150)
  })

  it('does not wait when minIntervalMs has already elapsed', () => {
    expect(computeThrottleDelayMs(1_000, 1_300, 200)).toBe(0)
  })

  it('does not wait when exactly minIntervalMs has elapsed', () => {
    expect(computeThrottleDelayMs(1_000, 1_200, 200)).toBe(0)
  })
})

/** A fake clock: no real timers, `now` advances manually via `sleep`. */
function fakeClock(): Clock & { sleeps: number[]; now: () => number; advance: (ms: number) => void } {
  let time = 0
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => time,
    advance(ms: number) {
      time += ms
    },
    async sleep(ms: number) {
      sleeps.push(ms)
      time += ms
    },
  }
}

describe('createThrottler', () => {
  it('does not sleep before the first operation', async () => {
    const clock = fakeClock()
    const throttler = createThrottler(200, clock)

    await throttler.wait()

    expect(clock.sleeps).toEqual([])
  })

  it('sleeps for the remaining interval on a fast second call, never using a real timer', async () => {
    const clock = fakeClock()
    const throttler = createThrottler(200, clock)

    await throttler.wait()
    clock.advance(50)
    await throttler.wait()

    expect(clock.sleeps).toEqual([150])
  })

  it('does not sleep again once enough time has passed on its own', async () => {
    const clock = fakeClock()
    const throttler = createThrottler(200, clock)

    await throttler.wait()
    clock.advance(500)
    await throttler.wait()

    expect(clock.sleeps).toEqual([])
  })
})
