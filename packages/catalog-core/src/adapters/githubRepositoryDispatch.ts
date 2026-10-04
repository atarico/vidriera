import type { RebuildTrigger } from '../ports'

export interface GithubRepositoryDispatchConfig {
  token: string
  /** `owner/name` of the repository whose workflow should run. */
  repository: string
  eventType?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

const REPOSITORY_SHAPE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

/**
 * RebuildTrigger adapter over GitHub's repository_dispatch API: a workflow
 * listening for `eventType` rebuilds the storefront. The only file that
 * knows about GitHub's REST shape; `fetch` is injected so tests never touch
 * the network.
 */
export function createGithubRepositoryDispatch(
  config: GithubRepositoryDispatchConfig,
): RebuildTrigger {
  const {
    token,
    repository,
    eventType = 'catalog-updated',
    fetch: fetchImpl = globalThis.fetch,
    timeoutMs = 5000,
  } = config

  if (!REPOSITORY_SHAPE.test(repository)) {
    throw new Error(`Invalid GitHub repository "${repository}": expected the form owner/name`)
  }

  const url = `https://api.github.com/repos/${repository}/dispatches`

  return {
    async trigger(reason) {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'vidriera-rebuild-trigger',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event_type: eventType, client_payload: { reason } }),
        // Bounded so a hung GitHub call cannot stall the Lambda or the task.
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!response.ok) {
        // Status only: the message ends up in logs, so it must never carry
        // the token or request headers.
        throw new Error(`GitHub repository_dispatch failed with status ${response.status}`)
      }
    },
  }
}
