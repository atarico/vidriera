import { describe, expect, it } from 'vitest'
import { parseReplayCount } from './sqsDlqAdapter'

describe('parseReplayCount', () => {
  it('defaults to 0 when the message has never carried a ReplayCount attribute (first time in the DLQ)', () => {
    expect(parseReplayCount(undefined)).toBe(0)
    expect(parseReplayCount({})).toBe(0)
  })

  it('parses a numeric ReplayCount attribute', () => {
    expect(parseReplayCount({ ReplayCount: { StringValue: '2' } })).toBe(2)
  })

  it('defaults to 0 for a malformed ReplayCount value rather than throwing', () => {
    expect(parseReplayCount({ ReplayCount: { StringValue: 'not-a-number' } })).toBe(0)
  })

  it('defaults to 0 for a negative ReplayCount value', () => {
    expect(parseReplayCount({ ReplayCount: { StringValue: '-1' } })).toBe(0)
  })
})
