export interface SourceFile {
  path: string
  content: string
}

export interface EnvGuardViolation {
  file: string
  variable: string
  reason: string
}

/**
 * Vite/Astro's own env-access globals that are not credentials and are safe
 * to reference from anywhere, including client-bundled code.
 */
const BUILTIN_ENV_KEYS = new Set(['MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'])

/**
 * Name pattern for a variable that is, or was renamed to look like, an
 * elevated-privilege credential. This intentionally ignores the PUBLIC_
 * prefix: the realistic failure mode this guards against is a developer
 * hitting "this env var is undefined in the browser" and "fixing" it by
 * renaming an admin/write key to PUBLIC_SOMETHING_ADMIN_KEY, which Vite
 * would then happily embed verbatim into the static bundle. This app never
 * legitimately needs an admin/secret credential anywhere — build-time data
 * fetching (see catalogClient.ts) uses the same search-only key as the
 * browser — so any match here is a defect regardless of prefix or file.
 */
const SENSITIVE_NAME_PATTERN = /ADMIN|SECRET|MASTER|WRITE_KEY|_TOKEN\b/i

/** `import.meta.env.KEY` / `process.env.KEY` (plain dot access). */
const ENV_DOT_ACCESS_PATTERN = /\b(?:import\.meta\.env|process\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g

/** `import.meta.env['KEY']` / `process.env["KEY"]` (bracket access). */
const ENV_BRACKET_ACCESS_PATTERN =
  /\b(?:import\.meta\.env|process\.env)\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g

/**
 * `const { KEY } = import.meta.env` / `const { KEY: alias } = process.env`
 * (destructuring straight off the env object). This intentionally does NOT
 * match a destructure off an already-aliased variable — see the "known gap"
 * note below.
 */
const ENV_DESTRUCTURE_PATTERN = /\{([^{}]*)\}\s*=\s*(?:import\.meta\.env|process\.env)\b/g

/**
 * Extracts the source env var names from a destructuring binding list, e.g.
 * `"PUBLIC_ADMIN_KEY: adminKey, PUBLIC_ALGOLIA_APP_ID"` -> the names being
 * read from the env object are on the LEFT of any `:` rename and before any
 * `=` default, which is what must be checked — the local alias is
 * irrelevant to whether the underlying credential leaked.
 */
function extractDestructuredEnvNames(bindingList: string): string[] {
  return bindingList
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith('...'))
    .map((entry) => entry.split(':')[0]?.split('=')[0]?.trim() ?? '')
    .filter((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
}

/**
 * Scans storefront source files for any reference to an environment
 * variable whose name looks like an admin/secret credential. Intended to
 * run as a build-time gate (see scripts/guard-source-env.ts) so a leak is a
 * build failure, not a devtools discovery.
 *
 * Covers dot access, bracket access and destructuring straight off
 * `import.meta.env` / `process.env`.
 *
 * KNOWN GAP: this is a regex-based scan, not real static analysis, so it
 * cannot reliably follow a locally aliased reference to the env object —
 * e.g. `const e = import.meta.env; e.PUBLIC_ADMIN_KEY` reaches this
 * function unflagged. Catching that reliably needs an AST-based scan (or a
 * TypeScript compiler API pass), which is a larger, separate change. This
 * limitation is deliberately not hidden: see the pinned "KNOWN GAP" test in
 * envGuard.test.ts.
 */
export function findAdminKeyLeakRisk(files: SourceFile[]): EnvGuardViolation[] {
  const violations: EnvGuardViolation[] = []

  const pushIfSensitive = (file: SourceFile, variable: string | undefined) => {
    if (!variable || BUILTIN_ENV_KEYS.has(variable)) return
    if (!SENSITIVE_NAME_PATTERN.test(variable)) return

    violations.push({
      file: file.path,
      variable,
      reason: `"${variable}" looks like an admin/secret credential and must never be referenced in the storefront app`,
    })
  }

  for (const file of files) {
    for (const match of file.content.matchAll(ENV_DOT_ACCESS_PATTERN)) {
      pushIfSensitive(file, match[1])
    }

    for (const match of file.content.matchAll(ENV_BRACKET_ACCESS_PATTERN)) {
      pushIfSensitive(file, match[1])
    }

    for (const match of file.content.matchAll(ENV_DESTRUCTURE_PATTERN)) {
      for (const variable of extractDestructuredEnvNames(match[1] ?? '')) {
        pushIfSensitive(file, variable)
      }
    }
  }

  return violations
}
