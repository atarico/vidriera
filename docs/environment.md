# Environment variables

This file is the credential reference for every service in this repository. It exists
because **the sandbox this project was built in refuses to write any `.env*` path** —
there is no `.env.example` to read instead. Copy the tables below into whatever
mechanism each service actually reads from (a local `.env` file, `terraform.tfvars`,
SSM Parameter Store, or your shell) — see the "Where it's read from" column.

**Before you do anything else, read the two rules below. Getting either wrong is a
real security incident, not a style nit.**

> [!WARNING]
> **Astro/Vite only embeds variables prefixed `PUBLIC_` into the browser bundle.**
> Every storefront variable below that customers' browsers must see is spelled
> `PUBLIC_...` on purpose. **Never** rename `ALGOLIA_ADMIN_API_KEY` (or any other
> secret) to start with `PUBLIC_` to "make it work" in `apps/storefront` — that is
> the literal, realistic mistake that ships write-access-to-your-index to anyone who
> opens devtools on your site. The storefront's build fails on purpose if this
> happens: see `apps/storefront/src/lib/envGuard.ts` and
> `apps/storefront/scripts/guard-source-env.ts`.

> [!WARNING]
> **Sanity's Vite-based Studio CLI only embeds variables prefixed `SANITY_STUDIO_`.**
> `apps/studio` needs `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` — the
> *unprefixed* `SANITY_PROJECT_ID` / `SANITY_DATASET` the backend services read will
> silently not reach the Studio.

## Quick reference: what's a secret

| Symbol | Meaning |
|--------|---------|
| 🔒 | Secret. Never commit it, never log it, never let it reach a browser. |
| 🌐 | Public by design. Safe in a browser bundle. Still not something to hardcode carelessly (a leaked search key just lets someone else search your index for free; an admin key lets them rewrite it). |
| — | Not sensitive (an id, a name, a numeric tuning knob). |

## `services/ingest` (Lambda)

Verifies the Sanity webhook's HMAC signature and enqueues a message. Read from Lambda
environment variables, provisioned by Terraform from SSM Parameter Store
(`infra/terraform/ssm.tf`, `infra/terraform/lambda_ingest.tf`).

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `SANITY_WEBHOOK_SECRET` | 🔒 | Shared secret Sanity signs webhook payloads with. | Pick any strong random string yourself (e.g. `openssl rand -hex 32`); enter the *same* value when configuring the webhook in Sanity's dashboard. |
| `INGEST_QUEUE_URL` | — | SQS URL of the main ingest queue. | Set automatically by Terraform (`aws_sqs_queue.main.url`). Never set by hand. |
| `WEBHOOK_MAX_CLOCK_SKEW_MS` | — | Optional. Rejects a webhook whose timestamp is older than this. | Optional; default `300000` (5 minutes) is fine. |

## `services/indexer` (Lambda)

Consumes the queue, derives Cloudinary renditions, upserts into Algolia.

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `SANITY_PROJECT_ID` | — | Sanity project identifier. | Sanity dashboard → project settings, or `sanity.config.ts`. |
| `SANITY_DATASET` | — | Dataset name (usually `production`). | Chosen when the Sanity project/dataset is created. |
| `SANITY_TOKEN` | 🔒 (optional) | Read token, only needed if the dataset is private. | Sanity dashboard → API → Tokens (Viewer permission is enough). Leave unset for a public dataset — do not set it to an empty string; the code branches on *absence*, not emptiness. |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary account identifier. | Cloudinary dashboard home page. |
| `CLOUDINARY_API_KEY` | 🔒 | Cloudinary API key. | Cloudinary dashboard → Settings → Access Keys. |
| `CLOUDINARY_API_SECRET` | 🔒 | Cloudinary API secret. | Same page as the key. Never expose this anywhere near client code. |
| `ALGOLIA_APP_ID` | — | Algolia application id. | Algolia dashboard → your app → Settings → API Keys. |
| `ALGOLIA_ADMIN_API_KEY` | 🔒🔒 | Full read/write key for the index. | Algolia dashboard → API Keys → **Admin API Key**. This is the single most sensitive credential in the whole system — see the warning at the top of this file. |
| `ALGOLIA_INDEX_NAME` | — | The Algolia index products are written to. | Chosen by you (e.g. `vidriera_catalog`); must match the storefront's `PUBLIC_ALGOLIA_INDEX_NAME`. |

## `services/replay` (Lambda)

Drains the dead-letter queue back to the main queue, with a poison-message guard.

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `DLQ_URL` | — | SQS URL of the dead-letter queue. | Set automatically by Terraform. |
| `MAIN_QUEUE_URL` | — | SQS URL of the main queue. | Set automatically by Terraform. |
| `REPLAY_MAX_ATTEMPTS` | — | Optional. Messages replayed more than this many times are left parked instead of retried forever. | Optional; default `5`. |
| `REPLAY_MAX_MESSAGES_PER_RUN` | — | Optional. Caps how many messages one replay invocation moves. | Optional; default `100`. |

## `services/reindex-worker` (ECS Fargate task)

A full, throttled walk of every Sanity document, run on demand (never as a standing
service — see `docs/architecture.md`). Reads every `services/indexer` variable above,
plus:

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `REINDEX_MIN_INTERVAL_MS` | — | Optional. Minimum delay between writes, to stay under Algolia's rate limits. | Optional; default `100`. |
| `REINDEX_PAGE_SIZE` | — | Optional. Sanity documents fetched per page. | Optional; default `100`. |

## `apps/studio` (Sanity Studio)

Read by Vite at build/dev time — **must** use the `SANITY_STUDIO_` prefix, see the
warning above.

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `SANITY_STUDIO_PROJECT_ID` | — | Same project id as `SANITY_PROJECT_ID` above, re-declared with the required prefix. | Sanity dashboard. |
| `SANITY_STUDIO_DATASET` | — | Same dataset as `SANITY_DATASET` above, re-declared with the required prefix. | Sanity dashboard. |

## `apps/storefront` (Astro + React)

Read by Vite at **build time only** (this is a fully static site — there is no
server at request time). Every variable is `PUBLIC_`-prefixed and every one is safe
to ship to a browser, by construction: see the warning at the top of this file, and
`apps/storefront/src/lib/envGuard.ts` for the automated check.

| Variable | 🔒/🌐/— | What it is | Where to get it |
|---|---|---|---|
| `PUBLIC_ALGOLIA_APP_ID` | 🌐 | Same Algolia application id as the indexer. | Algolia dashboard. |
| `PUBLIC_ALGOLIA_SEARCH_API_KEY` | 🌐 | **A dedicated Search-Only API key — never the admin key.** | Algolia dashboard → API Keys → create a new key scoped to the `search` ACL only (or use the auto-generated default Search-Only Key). |
| `PUBLIC_ALGOLIA_INDEX_NAME` | 🌐 | Must match `ALGOLIA_INDEX_NAME` above exactly. | Chosen by you. |
| `PUBLIC_WHATSAPP_NUMBER` | 🌐 | Business WhatsApp number, digits only or with punctuation (the code strips non-digits). Full international format, e.g. `5491122334455`. | The business owner's WhatsApp Business number. A placeholder is fine until the real one is known (see `odd/tasks/catalog-platform.md`). |
| `PUBLIC_SITE_URL` | 🌐 | Absolute site URL, e.g. `https://miNegocio.com` or the CloudFront domain before a custom domain exists. Used to build canonical/`og:url` links and the link inside the WhatsApp message. | `terraform output storefront_cloudfront_domain_name`, or the eventual custom domain. |
| `PUBLIC_SITE_NAME` | 🌐 | Optional. Business/shop display name shown in the header and page titles. | Chosen by you; falls back to a generic "Catálogo" if unset. |
| `PUBLIC_SITE_TAGLINE` | 🌐 | Optional. One-line description shown in the header and used as the default meta description. | Chosen by you. |

## Why the search-only key is the only Algolia credential the storefront ever sees

The admin key can create, modify, and delete indices. The search-only key can only
run queries. `apps/storefront` never imports or references anything named like an
admin key — not even at build time: the product-detail pages' `getStaticPaths`
browses the catalog using the same search-only key the browser gets, precisely so
there is never a moment where a more privileged credential exists anywhere in this
app's process. Two build-time guards enforce this mechanically (not just by
convention): a static source scan for admin/secret-shaped variable names
(`guard-source-env.ts`) and a post-build scan of the compiled bundle for the literal
value of any known secret (`guard-bundle-secrets.ts`). Both run as part of
`pnpm --filter @vidriera/storefront build` and fail the build on a match.
