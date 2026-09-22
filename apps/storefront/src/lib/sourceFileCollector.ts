import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { SourceFile } from './envGuard'

/**
 * Extensions scanned for admin-key leak risk. Includes plain JavaScript
 * (.js/.mjs) alongside TypeScript/Astro sources: a hand-written config
 * helper or a root-level build config can reference
 * `import.meta.env`/`process.env` in a .js/.mjs file just as easily as in a
 * .ts file, and must not be able to dodge the guard by file extension.
 */
export const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.astro', '.js', '.mjs'])

/** Directories never worth scanning, even at the project root. */
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', '.astro', 'public'])

function isScannable(entryName: string): boolean {
  return SCANNED_EXTENSIONS.has(extname(entryName)) && !entryName.endsWith('.test.ts')
}

function collectRecursive(dir: string, projectRoot: string): SourceFile[] {
  const files: SourceFile[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry)) continue
      files.push(...collectRecursive(fullPath, projectRoot))
      continue
    }

    if (!isScannable(entry)) continue

    files.push({ path: fullPath.slice(projectRoot.length), content: readFileSync(fullPath, 'utf8') })
  }

  return files
}

function collectTopLevelOnly(dir: string, projectRoot: string): SourceFile[] {
  const files: SourceFile[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)

    if (stats.isDirectory()) continue
    if (!isScannable(entry)) continue

    files.push({ path: fullPath.slice(projectRoot.length), content: readFileSync(fullPath, 'utf8') })
  }

  return files
}

/**
 * Collects every storefront source file the admin-key leak guard
 * (see envGuard.ts) should scan:
 *
 * - everything under src/, recursively
 * - project-root config files, non-recursively (e.g. astro.config.mjs) —
 *   a Vite `define` there can inject a secret straight into the client
 *   bundle just as easily as a src/ reference can, so it must not be
 *   exempt from the scan
 *
 * node_modules, dist, .astro and public are never descended into.
 */
export function collectStorefrontSourceFiles(projectRoot: string): SourceFile[] {
  const srcDir = join(projectRoot, 'src')
  const fromRoot = collectTopLevelOnly(projectRoot, projectRoot)
  const fromSrc = collectRecursive(srcDir, projectRoot)
  return [...fromRoot, ...fromSrc]
}
