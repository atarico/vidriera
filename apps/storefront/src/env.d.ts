/// <reference types="astro/client" />

// Every variable listed here is PUBLIC_-prefixed on purpose: Astro/Vite only
// embeds PUBLIC_-prefixed variables into client-side code (see
// docs/environment.md). This app must never declare a binding for a
// non-PUBLIC_ credential — see src/lib/envGuard.ts, which fails the build if
// one is ever referenced.
interface ImportMetaEnv {
  readonly PUBLIC_ALGOLIA_APP_ID: string | undefined
  readonly PUBLIC_ALGOLIA_SEARCH_API_KEY: string | undefined
  readonly PUBLIC_ALGOLIA_INDEX_NAME: string | undefined
  readonly PUBLIC_WHATSAPP_NUMBER: string | undefined
  readonly PUBLIC_SITE_URL: string | undefined
  readonly PUBLIC_SITE_NAME: string | undefined
  readonly PUBLIC_SITE_TAGLINE: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
