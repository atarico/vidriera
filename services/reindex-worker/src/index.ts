import {
  createAlgoliaSearchIndex,
  createCloudinaryImageStore,
  createGithubRepositoryDispatch,
  createNoopRebuildTrigger,
  createSanityContentSource,
} from '@vidriera/catalog-core'
import type { RebuildTrigger } from '@vidriera/catalog-core'
import { genericRubroProfile } from '@vidriera/contracts'
import { createThrottler, systemClock } from './domain/throttle'
import { triggerRebuildAfterReindex } from './domain/rebuild'
import { reindexAll } from './domain/run'

const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MIN_INTERVAL_MS = 100 // paces writes to stay under Algolia's rate limits

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}

// Both vars set enables rebuilds, both absent disables them; half-configured
// fails fast instead of silently never rebuilding.
function buildRebuildTriggerFromEnv(): RebuildTrigger {
  const token = process.env.REBUILD_GITHUB_TOKEN
  const repository = process.env.REBUILD_GITHUB_REPOSITORY
  if (token && repository) {
    return createGithubRepositoryDispatch({ token, repository })
  }
  if (!token && !repository) {
    return createNoopRebuildTrigger()
  }
  throw new Error(
    'REBUILD_GITHUB_TOKEN and REBUILD_GITHUB_REPOSITORY must be set together or both left unset',
  )
}

/**
 * ECS Fargate task entry point. Thin: builds adapters from env, delegates
 * the whole walk to the pure/testable reindexAll use case, and is the only
 * place in this service that decides the process exit code — ECS records
 * the task as failed exactly when this exits non-zero.
 */
async function main(): Promise<void> {
  // The rubro profile is the single swap point (@vidriera/contracts/rubro).
  const profile = genericRubroProfile

  const contentSource = createSanityContentSource(
    {
      projectId: requireEnv('SANITY_PROJECT_ID'),
      dataset: requireEnv('SANITY_DATASET'),
      token: process.env.SANITY_TOKEN,
    },
    profile,
  )
  const imageStore = createCloudinaryImageStore({
    cloudName: requireEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: requireEnv('CLOUDINARY_API_KEY'),
    apiSecret: requireEnv('CLOUDINARY_API_SECRET'),
  })
  const searchIndex = createAlgoliaSearchIndex({
    appId: requireEnv('ALGOLIA_APP_ID'),
    apiKey: requireEnv('ALGOLIA_ADMIN_API_KEY'),
    indexName: requireEnv('ALGOLIA_INDEX_NAME'),
  })
  const minIntervalMs = process.env.REINDEX_MIN_INTERVAL_MS
    ? Number(process.env.REINDEX_MIN_INTERVAL_MS)
    : DEFAULT_MIN_INTERVAL_MS
  const pageSize = process.env.REINDEX_PAGE_SIZE
    ? Number(process.env.REINDEX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  const rebuildTrigger = buildRebuildTriggerFromEnv()

  const summary = await reindexAll({
    contentSource,
    imageStore,
    searchIndex,
    profile,
    throttler: createThrottler(minIntervalMs, systemClock),
    pageSize,
  })

  console.log(JSON.stringify(summary))

  await triggerRebuildAfterReindex(summary, rebuildTrigger)

  if (summary.failed > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('Reindex worker failed', error)
  process.exitCode = 1
})
