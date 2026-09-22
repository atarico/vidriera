export interface BundleFile {
  path: string
  content: string
}

export interface LeakFinding {
  file: string
  secretName: string
}

/**
 * Below this length a "secret" is too short to check without risking
 * trivial false positives (e.g. a short flag value coincidentally
 * appearing in minified code).
 */
const MIN_SECRET_LENGTH = 8

/**
 * Defense-in-depth ground-truth check: after `astro build`, scan every
 * emitted bundle file for the LITERAL VALUE of each known sensitive
 * credential the build environment holds. This catches a leak regardless
 * of how it happened — a naming-convention mistake, a misconfigured
 * plugin, or anything findAdminKeyLeakRisk's static, name-based scan
 * didn't anticipate. Secrets that are unset (undefined) or empty are
 * skipped: an empty string would otherwise "match" every file.
 */
export function findLeakedSecretsInBundle(
  files: BundleFile[],
  secrets: Record<string, string | undefined>,
): LeakFinding[] {
  const findings: LeakFinding[] = []

  const activeSecrets = Object.entries(secrets).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === 'string' && entry[1].length >= MIN_SECRET_LENGTH,
  )

  for (const file of files) {
    for (const [secretName, secretValue] of activeSecrets) {
      if (file.content.includes(secretValue)) {
        findings.push({ file: file.path, secretName })
      }
    }
  }

  return findings
}
