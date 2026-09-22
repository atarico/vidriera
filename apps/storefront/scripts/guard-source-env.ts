#!/usr/bin/env node
/**
 * Build-time gate: fails the build if any storefront source file references
 * an environment variable that looks like an admin/secret credential (see
 * src/lib/envGuard.ts for the exact rule and why it matches on name, not
 * just prefix). Runs before `astro build` — see package.json's "build"
 * script — so this app never even attempts to compile a leak.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findAdminKeyLeakRisk } from '../src/lib/envGuard.ts'
import type { SourceFile } from '../src/lib/envGuard.ts'

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.astro'])
const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const srcDir = join(projectRoot, 'src')

function collectSourceFiles(dir: string): SourceFile[] {
  const files: SourceFile[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
      continue
    }

    if (!SCANNED_EXTENSIONS.has(extname(entry))) continue
    if (entry.endsWith('.test.ts')) continue

    files.push({ path: fullPath.slice(projectRoot.length), content: readFileSync(fullPath, 'utf8') })
  }

  return files
}

const files = collectSourceFiles(srcDir)
const violations = findAdminKeyLeakRisk(files)

if (violations.length > 0) {
  console.error('\n✖ Admin-key leak risk guard failed.\n')
  for (const violation of violations) {
    console.error(`  ${violation.file}: ${violation.reason}`)
  }
  console.error(
    '\nThe storefront must only ever reference PUBLIC_-prefixed, search-only credentials.\n',
  )
  process.exit(1)
}

console.log(`✓ Admin-key leak risk guard passed (${files.length} files scanned).`)
