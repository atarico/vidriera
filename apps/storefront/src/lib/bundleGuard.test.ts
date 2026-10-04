import { describe, expect, it } from 'vitest'
import { findLeakedSecretsInBundle } from './bundleGuard'

describe('findLeakedSecretsInBundle', () => {
  it('finds a secret literal value leaked into a built bundle file', () => {
    const findings = findLeakedSecretsInBundle(
      [{ path: 'dist/_astro/search.abc123.js', content: 'const k="sk_live_admin_9f8e7d6c5b4a"' }],
      { ALGOLIA_ADMIN_API_KEY: 'sk_live_admin_9f8e7d6c5b4a' },
    )
    expect(findings).toEqual([
      { file: 'dist/_astro/search.abc123.js', secretName: 'ALGOLIA_ADMIN_API_KEY' },
    ])
  })

  it('reports no findings when no secret value appears in any bundle file', () => {
    const findings = findLeakedSecretsInBundle(
      [{ path: 'dist/_astro/search.abc123.js', content: 'const k="just-a-public-search-key"' }],
      { ALGOLIA_ADMIN_API_KEY: 'sk_live_admin_9f8e7d6c5b4a' },
    )
    expect(findings).toEqual([])
  })

  it('ignores unset (undefined) secrets instead of matching an empty string against everything', () => {
    const findings = findLeakedSecretsInBundle(
      [{ path: 'dist/_astro/search.abc123.js', content: 'anything at all' }],
      { ALGOLIA_ADMIN_API_KEY: undefined },
    )
    expect(findings).toEqual([])
  })

  it('ignores a secret value shorter than the minimum length to avoid trivial false positives', () => {
    const findings = findLeakedSecretsInBundle(
      [{ path: 'dist/_astro/search.abc123.js', content: 'x=1' }],
      { SOME_FLAG: '1' },
    )
    expect(findings).toEqual([])
  })

  it('scans every bundle file and reports every match, one finding per file/secret pair', () => {
    const findings = findLeakedSecretsInBundle(
      [
        { path: 'dist/_astro/a.js', content: 'has-secret-value-abc123456789' },
        { path: 'dist/_astro/b.js', content: 'clean file' },
        { path: 'dist/_astro/c.js', content: 'has-secret-value-abc123456789 too' },
      ],
      { SANITY_TOKEN: 'secret-value-abc123456789' },
    )
    expect(findings.map((f) => f.file).sort()).toEqual(['dist/_astro/a.js', 'dist/_astro/c.js'])
  })
})
