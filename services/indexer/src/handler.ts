import type { SQSBatchResponse, SQSEvent, SQSHandler } from 'aws-lambda'
import type { RubroProfile } from '@vidriera/contracts'
import {
  createAlgoliaSearchIndex,
  createCloudinaryImageStore,
  createGithubRepositoryDispatch,
  createNoopRebuildTrigger,
  createSanityContentSource,
} from '@vidriera/catalog-core'
import type { ContentSource, ImageStore, RebuildTrigger, SearchIndex } from '@vidriera/catalog-core'
import { genericRubroProfile } from '@vidriera/contracts'
import { buildBatchItemFailures } from './domain/buildBatchItemFailures'
import { indexMessage } from './domain/indexMessage'
import { parseIngestMessage } from './domain/parseIngestMessage'

export interface HandlerDependencies {
  contentSource: ContentSource
  imageStore: ImageStore
  searchIndex: SearchIndex
  profile: RubroProfile
  rebuildTrigger: RebuildTrigger
}

/**
 * Thin Lambda handler: parses each SQS record, delegates to the indexMessage
 * use case, and reports batchItemFailures so only records that actually
 * failed get retried — a whole-batch failure would redrive healthy records
 * into the DLQ alongside the broken one.
 */
export type SqsBatchHandler = (event: SQSEvent) => Promise<SQSBatchResponse>

export function createHandler(deps: HandlerDependencies): SqsBatchHandler {
  return async (event: SQSEvent) => {
    const outcomes = await Promise.all(
      event.Records.map(async (record) => {
        const parsed = parseIngestMessage(record.body)
        if (!parsed.ok) {
          console.error(`Rejecting message ${record.messageId}: ${parsed.reason}`)
          return { messageId: record.messageId, ok: false }
        }

        try {
          const outcome = await indexMessage(parsed.message, deps)
          return { messageId: record.messageId, ok: true, outcome }
        } catch (error) {
          console.error(`Failed to index message ${record.messageId}`, error)
          return { messageId: record.messageId, ok: false }
        }
      }),
    )

    // One rebuild per batch, and only if the catalog actually changed: a
    // skipped-only or all-failed batch leaves the published site accurate.
    const changed = outcomes.filter(
      (o) =>
        o.ok && o.outcome && (o.outcome.status === 'indexed' || o.outcome.status === 'deleted'),
    ).length
    if (changed > 0) {
      try {
        await deps.rebuildTrigger.trigger(`indexer batch changed ${changed} document(s)`)
      } catch (error) {
        // Contained: the records are already indexed, so failing the batch
        // would only redrive healthy messages.
        console.error(
          `Storefront rebuild trigger failed: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return buildBatchItemFailures(outcomes)
  }
}

let cachedHandler: SqsBatchHandler | undefined

export const handler: SQSHandler = async (event) => {
  if (!cachedHandler) {
    cachedHandler = createHandler(buildDependenciesFromEnv())
  }
  return cachedHandler(event)
}

function buildDependenciesFromEnv(): HandlerDependencies {
  const sanityProjectId = requireEnv('SANITY_PROJECT_ID')
  const sanityDataset = requireEnv('SANITY_DATASET')
  const sanityToken = process.env.SANITY_TOKEN
  const cloudinaryCloudName = requireEnv('CLOUDINARY_CLOUD_NAME')
  const cloudinaryApiKey = requireEnv('CLOUDINARY_API_KEY')
  const cloudinaryApiSecret = requireEnv('CLOUDINARY_API_SECRET')
  const algoliaAppId = requireEnv('ALGOLIA_APP_ID')
  const algoliaAdminKey = requireEnv('ALGOLIA_ADMIN_API_KEY')
  const algoliaIndexName = requireEnv('ALGOLIA_INDEX_NAME')

  // The rubro profile is the single swap point (@vidriera/contracts/rubro).
  // Only that file changes when the vertical becomes known.
  const profile = genericRubroProfile

  return {
    contentSource: createSanityContentSource(
      { projectId: sanityProjectId, dataset: sanityDataset, token: sanityToken },
      profile,
    ),
    imageStore: createCloudinaryImageStore({
      cloudName: cloudinaryCloudName,
      apiKey: cloudinaryApiKey,
      apiSecret: cloudinaryApiSecret,
    }),
    searchIndex: createAlgoliaSearchIndex({
      appId: algoliaAppId,
      apiKey: algoliaAdminKey,
      indexName: algoliaIndexName,
    }),
    profile,
    rebuildTrigger: buildRebuildTriggerFromEnv(),
  }
}

// Both vars set enables rebuilds, both absent disables them; a half-configured
// pair is almost certainly a mistake, so fail at cold start instead of
// silently never rebuilding.
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

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set`)
  }
  return value
}
