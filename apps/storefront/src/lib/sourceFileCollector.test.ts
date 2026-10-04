import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { collectStorefrontSourceFiles, SCANNED_EXTENSIONS } from './sourceFileCollector'
import { findAdminKeyLeakRisk } from './envGuard'

// Defect: the pre-build scan only ever walked src/, so astro.config.mjs at
// the project root — where a Vite `define` can inject a secret straight
// into the bundle — was never checked. It also only recognized
// .ts/.tsx/.astro, so a plain .js/.mjs source file dodged the guard
// entirely. These tests build a real fixture directory tree and prove both
// gaps are closed.

let projectRoot: string

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true })
})

function makeFixtureProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'vidriera-source-scan-'))
  mkdirSync(join(root, 'src', 'lib'), { recursive: true })
  mkdirSync(join(root, 'node_modules', 'some-pkg'), { recursive: true })
  mkdirSync(join(root, 'dist'), { recursive: true })
  return root
}

describe('SCANNED_EXTENSIONS', () => {
  it('includes .js and .mjs alongside .ts, .tsx and .astro', () => {
    expect(SCANNED_EXTENSIONS.has('.ts')).toBe(true)
    expect(SCANNED_EXTENSIONS.has('.tsx')).toBe(true)
    expect(SCANNED_EXTENSIONS.has('.astro')).toBe(true)
    expect(SCANNED_EXTENSIONS.has('.js')).toBe(true)
    expect(SCANNED_EXTENSIONS.has('.mjs')).toBe(true)
  })
})

describe('collectStorefrontSourceFiles', () => {
  it('scans project-root config files such as astro.config.mjs, not just src/', () => {
    projectRoot = makeFixtureProject()
    writeFileSync(
      join(projectRoot, 'astro.config.mjs'),
      "export default { vite: { define: { KEY: process.env.PUBLIC_ADMIN_KEY } } }",
    )

    const files = collectStorefrontSourceFiles(projectRoot)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('/astro.config.mjs')

    // And the guard actually catches the leak once the file is scanned.
    const violations = findAdminKeyLeakRisk(files)
    expect(violations.some((v) => v.file === '/astro.config.mjs')).toBe(true)
  })

  it('scans .js and .mjs source files under src/, not just .ts/.tsx/.astro', () => {
    projectRoot = makeFixtureProject()
    writeFileSync(
      join(projectRoot, 'src', 'lib', 'legacyHelper.js'),
      'export const key = import.meta.env.PUBLIC_ADMIN_KEY',
    )
    writeFileSync(
      join(projectRoot, 'src', 'lib', 'config.mjs'),
      'export const secret = process.env.SANITY_TOKEN',
    )

    const files = collectStorefrontSourceFiles(projectRoot)
    const paths = files.map((f) => f.path)
    expect(paths).toContain('/src/lib/legacyHelper.js')
    expect(paths).toContain('/src/lib/config.mjs')

    const violations = findAdminKeyLeakRisk(files)
    expect(violations).toHaveLength(2)
  })

  it('still excludes node_modules and dist at the project root', () => {
    projectRoot = makeFixtureProject()
    writeFileSync(join(projectRoot, 'node_modules', 'some-pkg', 'index.js'), 'ignored')
    writeFileSync(join(projectRoot, 'dist', 'bundle.js'), 'ignored')

    const files = collectStorefrontSourceFiles(projectRoot)
    const paths = files.map((f) => f.path)
    expect(paths.some((p) => p.includes('node_modules'))).toBe(false)
    expect(paths.some((p) => p.includes('/dist/'))).toBe(false)
  })

  it('still excludes .test.ts files', () => {
    projectRoot = makeFixtureProject()
    writeFileSync(join(projectRoot, 'src', 'lib', 'foo.test.ts'), 'ignored')

    const files = collectStorefrontSourceFiles(projectRoot)
    expect(files.some((f) => f.path.endsWith('foo.test.ts'))).toBe(false)
  })
})
