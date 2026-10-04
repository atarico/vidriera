import type { RebuildTrigger } from '../ports'

/**
 * RebuildTrigger used when automatic storefront rebuilds are not configured,
 * so callers never branch on "is a trigger wired?".
 */
export function createNoopRebuildTrigger(): RebuildTrigger {
  return {
    async trigger() {},
  }
}
