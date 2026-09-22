#!/usr/bin/env node
/**
 * Build-time gate: fails the build if any storefront source file references
 * an environment variable that looks like an admin/secret credential (see
 * src/lib/envGuard.ts for the exact rule and why it matches on name, not
 * just prefix). Runs before `astro build` — see package.json's "build"
 * script — so this app never even attempts to compile a leak.
 *
 * File collection (which files count as "storefront source", including
 * project-root config files like astro.config.mjs and .js/.mjs sources) is
 * in src/lib/sourceFileCollector.ts, unit-tested there.
 */
import { fileURLToPath } from 'node:url'
import { findAdminKeyLeakRisk } from '../src/lib/envGuard.ts'
import { collectStorefrontSourceFiles } from '../src/lib/sourceFileCollector.ts'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const files = collectStorefrontSourceFiles(projectRoot)
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
