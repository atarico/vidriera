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

  // --- Bypass forms (each one previously produced ZERO matches and reached
  // the browser bundle unflagged) ---

  it('flags bracket notation with single quotes: import.meta.env[\'KEY\']', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/algoliaClient.ts',
        content: "const key = import.meta.env['PUBLIC_ALGOLIA_ADMIN_API_KEY']",
      },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('PUBLIC_ALGOLIA_ADMIN_API_KEY')
  })

  it('flags bracket notation with double quotes on process.env too', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'scripts/build.ts', content: 'const s = process.env["CLOUDINARY_API_SECRET"]' },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('CLOUDINARY_API_SECRET')
  })

  it('does not flag bracket notation for a clean, non-sensitive key', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'src/lib/algoliaClient.ts', content: "import.meta.env['PUBLIC_ALGOLIA_APP_ID']" },
    ])
    expect(violations).toEqual([])
  })

  it('flags destructuring straight off import.meta.env', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/islands/SearchExperience.tsx',
        content: 'const { PUBLIC_ALGOLIA_ADMIN_API_KEY } = import.meta.env',
      },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('PUBLIC_ALGOLIA_ADMIN_API_KEY')
  })

  it('flags a renamed destructured binding by its source env var name, not the alias', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/foo.ts',
        content: 'const { PUBLIC_ADMIN_KEY: adminKey } = import.meta.env',
      },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('PUBLIC_ADMIN_KEY')
  })

  it('flags destructuring off process.env too', () => {
    const violations = findAdminKeyLeakRisk([
      { path: 'scripts/build.ts', content: 'const { SANITY_TOKEN } = process.env' },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('SANITY_TOKEN')
  })

  it('flags only the sensitive name among multiple destructured bindings', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/foo.ts',
        content: 'const { PUBLIC_ALGOLIA_APP_ID, PUBLIC_ADMIN_KEY } = import.meta.env',
      },
    ])
    expect(violations).toHaveLength(1)
    expect(violations[0]?.variable).toBe('PUBLIC_ADMIN_KEY')
  })

  // Known, documented limitation: aliasing the whole env object first
  // (`const e = import.meta.env; e.PUBLIC_ADMIN_KEY`) cannot be caught
  // reliably by a regex-based scan — it would need real static analysis of
  // variable bindings across statements. This test pins that limitation so
  // the guard never silently implies coverage it does not have; see the
  // comment above ENV_ACCESS_PATTERN in envGuard.ts.
  it('KNOWN GAP: does not catch access through a locally aliased env object', () => {
    const violations = findAdminKeyLeakRisk([
      {
        path: 'src/lib/foo.ts',
        content: 'const e = import.meta.env\nconst k = e.PUBLIC_ADMIN_KEY',
      },
    ])
    expect(violations).toEqual([])
  })
})
