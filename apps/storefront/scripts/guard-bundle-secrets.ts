#!/usr/bin/env node
/**
 * Build-time gate: after `astro build` has produced the static ./dist
 * output, scan every emitted file for the literal value of any sensitive
 * credential present in the build environment. This is the ground-truth
 * companion to guard-source-env.ts's name-based static scan: it catches an
 * actual leaked secret regardless of how it got there.
 *
 * Secret names here intentionally mirror the non-storefront services'
 * environment variables from odd/tasks/catalog-platform.md — none of them
 * should ever be set when building the storefront, but if one leaks in via
 * a shared CI environment, this is what catches it before deploy.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findLeakedSecretsInBundle } from '../src/lib/bundleGuard.ts'
import type { BundleFile } from '../src/lib/bundleGuard.ts'

const SENSITIVE_ENV_NAMES = [
  'ALGOLIA_ADMIN_API_KEY',
  'SANITY_TOKEN',
  'SANITY_WEBHOOK_SECRET',
  'CLOUDINARY_API_SECRET',
] as const

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(projectRoot, 'dist')

function collectBundleFiles(dir: string): BundleFile[] {
  const files: BundleFile[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...collectBundleFiles(fullPath))
      continue
    }

    files.push({ path: fullPath.slice(projectRoot.length), content: readFileSync(fullPath, 'utf8') })
  }

  return files
}

let distExists = true
try {
  statSync(distDir)
} catch {
  distExists = false
}

if (!distExists) {
  console.error(`\n✖ Bundle secret guard failed: ${distDir} does not exist. Did the build run?\n`)
  process.exit(1)
}

const secrets = Object.fromEntries(
  SENSITIVE_ENV_NAMES.map((name) => [name, process.env[name]]),
)

const files = collectBundleFiles(distDir)
const findings = findLeakedSecretsInBundle(files, secrets)

if (findings.length > 0) {
  console.error('\n✖ Bundle secret guard failed: a credential value leaked into the static build.\n')
  for (const finding of findings) {
    console.error(`  ${finding.file}: contains the value of ${finding.secretName}`)
  }
  process.exit(1)
}

console.log(`✓ Bundle secret guard passed (${files.length} build output files scanned).`)
