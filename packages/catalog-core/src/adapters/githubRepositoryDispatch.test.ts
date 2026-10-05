import { describe, expect, it } from 'vitest'
import { createGithubRepositoryDispatch } from './githubRepositoryDispatch'

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(status: number, calls: Call[]): typeof fetch {
  return async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} })
    return new Response(null, { status })
  }
}

function onlyCall(calls: Call[]): Call {
  const [call] = calls
  if (!call || calls.length !== 1) {
    throw new Error(`expected exactly one fetch call, got ${calls.length}`)
  }
  return call
}

describe('createGithubRepositoryDispatch', () => {
  it('posts a repository_dispatch event with the expected URL, headers and body', async () => {
    const calls: Call[] = []
    const trigger = createGithubRepositoryDispatch({
      token: 'secret-token',
      repository: 'acme/storefront',
      fetch: fakeFetch(204, calls),
    })

    await trigger.trigger('catalog changed')

    const call = onlyCall(calls)
    expect(call.url).toBe('https://api.github.com/repos/acme/storefront/dispatches')
    expect(call.init.method).toBe('POST')
    expect(call.init.headers).toEqual({
      Authorization: 'Bearer secret-token',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'vidriera-rebuild-trigger',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(call.init.body))).toEqual({
      event_type: 'catalog-updated',
      client_payload: { reason: 'catalog changed' },
    })
  })

  it('uses a custom event type when provided', async () => {
    const calls: Call[] = []
    const trigger = createGithubRepositoryDispatch({
      token: 't',
      repository: 'acme/storefront',
      eventType: 'rebuild',
      fetch: fakeFetch(204, calls),
    })

    await trigger.trigger('x')

    expect(JSON.parse(String(onlyCall(calls).init.body)).event_type).toBe('rebuild')
  })

  it('passes an abort signal so a hung request cannot block the caller', async () => {
    const calls: Call[] = []
    const trigger = createGithubRepositoryDispatch({
      token: 't',
      repository: 'acme/storefront',
      fetch: fakeFetch(204, calls),
    })

    await trigger.trigger('x')

    expect(onlyCall(calls).init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws with the status code but never the token on a non-2xx response', async () => {
    const trigger = createGithubRepositoryDispatch({
      token: 'secret-token',
      repository: 'acme/storefront',
      fetch: fakeFetch(401, []),
    })

    const error = await trigger.trigger('x').then(
      () => undefined,
      (e: unknown) => e as Error,
    )

    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toContain('401')
    expect(error?.message).not.toContain('secret-token')
  })

  it.each(['storefront', 'acme/', '/storefront', 'a/b/c', 'acme / storefront', ''])(
    'rejects the invalid repository %j at creation',
    (repository) => {
      expect(() => createGithubRepositoryDispatch({ token: 't', repository })).toThrow(
        /owner\/name/,
      )
    },
  )
})
