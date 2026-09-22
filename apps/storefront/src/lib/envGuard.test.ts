import { describe, expect, it } from 'vitest'
import { findAdminKeyLeakRisk } from './envGuard'

describe('findAdminKeyLeakRisk', () => {
  it('allows a clean PUBLIC_-prefixed reference used for the search-only client', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/algoliaClient.ts',
        content: 'const key = import.meta.env.PUBLIC_ALGOLIA_SEARCH_API_KEY',
      },
    ])
    expect(violations).toEqual([])
  })

  it('flags an admin-key-shaped variable even if someone PUBLIC_-prefixed it', () => {
    // This is the real failure mode: an admin key that "doesn't work in the
    // browser" gets renamed with a PUBLIC_ prefix to make Vite embed it.
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/islands/SearchExperience.tsx',
        content: 'const key = import.meta.env.PUBLIC_ALGOLIA_ADMIN_API_KEY',
      },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({
      file: 'src/islands/SearchExperience.tsx',
      variable: 'PUBLIC_ALGOLIA_ADMIN_API_KEY',
    })
  })

  it('flags a non-PUBLIC admin/secret reference anywhere in the app too', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'src/pages/index.astro', content: 'const t = import.meta.env.SANITY_TOKEN' },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('SANITY_TOKEN')
  })

  it('flags process.env references too, not just import.meta.env', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'scripts/build.ts', content: 'const s = process.env.CLOUDINARY_API_SECRET' },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('CLOUDINARY_API_SECRET')
  })

  it('never flags Vite/Astro built-in env keys', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/foo.ts',
        content: 'if (import.meta.env.DEV) { console.log(import.meta.env.MODE) }',
      },
    ])
    expect(violations).toEqual([])
  })

  it('never flags ordinary PUBLIC_ variables that do not look like a secret', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/algoliaClient.ts',
        content: [
          'import.meta.env.PUBLIC_ALGOLIA_APP_ID',
          'import.meta.env.PUBLIC_ALGOLIA_INDEX_NAME',
          'import.meta.env.PUBLIC_WHATSAPP_NUMBER',
          'import.meta.env.PUBLIC_SITE_URL',
        ].join('\n'),
      },
    ])
    expect(violations).toEqual([])
  })

  it('aggregates violations across multiple files with correct file paths', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'a.ts', content: 'import.meta.env.ALGOLIA_ADMIN_API_KEY' },
      { path: 'b.ts', content: 'import.meta.env.SANITY_WEBHOOK_SECRET' },
      { path: 'c.ts', content: 'import.meta.env.PUBLIC_ALGOLIA_APP_ID' },
    ])
    expect(violations).toHaveLength(2)
    expect(violations.map((v) => v.file).sort()).toEqual(['a.ts', 'b.ts'])
  })
})
