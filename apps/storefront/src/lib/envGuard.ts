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

const ENV_ACCESS_PATTERN = /\b(?:import\.meta\.env|process\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g

/**
 * Scans storefront source files for any reference to an environment
 * variable whose name looks like an admin/secret credential. Intended to
 * run as a build-time gate (see scripts/guard-source-env.ts) so a leak is a
 * build failure, not a devtools discovery.
 */
export function findAdminKeyLeakRisk(files: SourceFile[]): EnvGuardViolation[] {
  const violations: EnvGuardViolation[] = []

  for (const file of files) {
    for (const match of file.content.matchAll(ENV_ACCESS_PATTERN)) {
      const variable = match[1]
      if (!variable || BUILTIN_ENV_KEYS.has(variable)) continue
      if (!SENSITIVE_NAME_PATTERN.test(variable)) continue

      violations.push({
        file: file.path,
        variable,
        reason: `"${variable}" looks like an admin/secret credential and must never be referenced in the storefront app`,
      })
    }
  }

  return violations
}
