import { describe, expect, it } from 'vitest'
import { decideReplay } from './replayDecision'

describe('decideReplay', () => {
  it('replays a message that has never been replayed, bumping the counter to 1', () => {
    expect(decideReplay({ replayCount: 0, maxReplays: 3 })).toEqual({ action: 'replay', nextReplayCount: 1 })
  })

  it('replays a message below the max, bumping the counter', () => {
    expect(decideReplay({ replayCount: 2, maxReplays: 3 })).toEqual({ action: 'replay', nextReplayCount: 3 })
  })

  it('parks a message that has reached the configured maximum, so it cannot ping-pong forever', () => {
    const result = decideReplay({ replayCount: 3, maxReplays: 3 })
    expect(result.action).toBe('park')
  })

  it('parks a message beyond the configured maximum', () => {
    const result = decideReplay({ replayCount: 10, maxReplays: 3 })
    expect(result.action).toBe('park')
  })
})
