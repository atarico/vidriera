# Feature: Generic Commerce Catalog Platform ("Vidriera")

## Objective

Build a rubro-agnostic online catalog that a small business can run for free on its own
domain, with faceted search and WhatsApp-based ordering. The vertical ("rubro") is
supplied later and must be swappable by editing a single configuration file.

## Problem

Small local businesses pay monthly fees (Tienda Nube) or per-sale commissions
(Mercado Libre) for a product catalog. They need their own catalog, on their own
domain, with no commission and no checkout complexity.

## Why

Primary purpose is skill acquisition across a job-market-relevant stack
(Sanity, Algolia, Cloudinary, AWS Lambda/SQS/ECS, Terraform, dead-letter queue
patterns) while producing something a real business can actually use.

## Scope

### In scope

- Rubro-agnostic product content model with a pluggable vertical profile
- Content ingestion pipeline: Sanity webhook -> Lambda -> SQS -> Lambda indexer
- Image optimization via Cloudinary (derived renditions stored on the search record)
- Faceted search index in Algolia
- Dead-letter queue: SQS redrive policy, replay Lambda, idempotent indexing
- Bulk reindex batch job on ECS Fargate (exceeds the Lambda 15-minute ceiling)
- Static storefront on S3 + CloudFront with WhatsApp order links
- Full infrastructure as code in Terraform, including a $1 budget alarm

### Out of scope

- Payments, checkout, cart persistence, order state machine
- Inventory synchronization with external POS systems
- Multi-tenant hosting (one deployment serves one business)
- The concrete vertical schema fields (deferred, see Constraints)

## Constraints

- **Rubro unknown until the next session.** Core schema must be vertical-neutral;
  all vertical-specific fields and facets come from one `rubro` profile module.
- Everything must fit inside free tiers. Fargate runs on demand only, never 24/7.
- No NAT Gateway (~USD 33/month). Fargate task runs in a public subnet with a
  public IP (~USD 3.65/month, and only while the batch job runs).
- Package manager is pnpm. npm is not used anywhere in this repo.
- Generated artifacts (code, comments, docs, UI copy) are written in English.

## Authorized scope

User authorized implementation ("hacelo") of the generic, rubro-agnostic platform.
Vertical-specific schema work is explicitly deferred to the next session.
Push, pull request creation, and merge remain user decisions.

## Verification

- TDD mode: **enabled** (source: user global CLAUDE.md, "Strict TDD Mode: enabled")
- Test runner: `pnpm vitest run` (unit tests for all TypeScript domain logic)
- Infrastructure checks: `terraform fmt -check` and `terraform validate`
- Type checks: `pnpm typecheck`
- TDD applies to Lambda/worker domain logic. Terraform is validated, not test-driven.

## Delivery

- Strategy: `single-pr` — greenfield scaffold in a solo repository; slicing an
  initial scaffold into chained PRs adds review ceremony with no reviewer benefit.
- Forecast: ~2000 authored changed lines across the task list.
- Work-unit commits on branch `feat/catalog-platform`, Conventional Commits.
- RDD is **on** (global). After each work-unit commit, run
  `gentle-ai review assess --cwd . --base-ref <last reviewed boundary> --committed-only --json`
  and record the assessed tier and outcome below.

## Tasks

| ID | Task | Route | Trigger evidence | Status |
|----|------|-------|------------------|--------|
| T1 | Shared contracts package: catalog record shape + rubro profile type | delegated | **route changed from inline**: the derivation functions carry real logic and TDD requires a working runner, which T2 sets up. Folded into the T1-T3 writer so RED could be observed properly | [x] |
| T2 | Repo scaffold: pnpm workspace, tsconfig, vitest, lint, .gitignore | delegated | writer trigger: 2+ non-trivial files | [x] |
| T3 | Sanity Studio v6 + vertical-neutral product schema driven by rubro profile | delegated | writer trigger: schema + studio config + desk structure | [x] |
| T4 | Lambda `ingest`: verify Sanity webhook signature, validate, enqueue to SQS | delegated | writer trigger: handler + domain + tests | [x] |
| T5 | Lambda `indexer`: SQS consumer, Cloudinary renditions, Algolia upsert, idempotency | delegated | writer trigger: handler + adapters + tests | [x] |
| T6 | Lambda `replay`: drain DLQ back to the main queue with poison-message guard | delegated | writer trigger: handler + domain + tests | [x] |
| T7 | ECS worker: throttled full reindex over all Sanity documents + Dockerfile | delegated | writer trigger: worker + throttle + tests + Dockerfile | [x] |
| T8 | Terraform: network, SQS + DLQ redrive, IAM roles | delegated | writer trigger: multiple .tf modules | [x] |
| T9 | Terraform: Lambdas, ECR, ECS cluster and task definition | delegated | writer trigger: multiple .tf modules | [x] |
| T10 | Terraform: S3 + CloudFront storefront, CloudWatch alarms, $1 budget | delegated | writer trigger: multiple .tf modules | [x] |
| T11 | Astro storefront: Algolia InstantSearch, facet UI, WhatsApp order link | delegated | writer trigger: pages + islands + styles | [x] |
| T12 | Docs: README, architecture diagram, account setup checklist, runbook | delegated | writer trigger: multiple docs | [x] |

## Acceptance criteria

- `pnpm vitest run` passes with meaningful unit coverage of domain logic
- `terraform validate` passes for every module
- A rubro can be swapped by editing only the rubro profile module; no other file
  in the repo hardcodes vertical-specific fields or facets
- The DLQ path is exercised by a test: a failing record lands in the DLQ after the
  configured receive count and the replay handler returns it to the main queue
- Indexing is idempotent: replaying the same record twice yields one Algolia object
- No Terraform resource creates a NAT Gateway
- A budget alarm at USD 1 exists in the Terraform plan

## Environment

| Tool | Status |
|------|--------|
| node | v24.14.1 |
| pnpm | 10.33.0 |
| docker | 29.8.1 |
| git | 2.55.0 |
| terraform | v1.16.3 (installed from `hashicorp/tap`; not in brew core since the BUSL relicense) |
| aws cli | 2.36.50 |

## Blocked on user (external accounts)

Code does not depend on these, but deployment does. None can be created by the agent.

- [ ] Sanity account + project id + dataset + write token
- [ ] Algolia account + app id + admin key + search-only key
- [ ] Cloudinary account + cloud name + api key + api secret
- [ ] AWS account + IAM user credentials + **budget alarm at USD 1 before first apply**
- [ ] Business WhatsApp number (can be a placeholder until the rubro is known)

## Progress

Working on branch `feat/catalog-platform`.

**T1–T3 complete** — commit `e877488` `feat: scaffold pnpm workspace, rubro contracts and Sanity Studio`.
33 files, ~1121 authored lines (the 10152-line `pnpm-lock.yaml` is generated and excluded).

This first work unit exceeds the ~400-line planning heuristic. Cause: a workspace
scaffold plus 33 tests lands as one indivisible unit — splitting tooling from the
package it configures would produce commits that do not build. Heuristic is
advisory; no rework performed.

### Sanity version correction

The original brief named Sanity Studio **v5**. The npm registry shows `latest: 6.15.0`
with v5 demoted to `maintenance-v5: 5.31.2`, so the project targets **v6**. The
`defineConfig` / `defineType` / `defineField` config API is unchanged from v3 through
v6, so this is a version bump, not an API migration.

## Verification evidence

| Check | Result | When |
|-------|--------|------|
| `pnpm install` | pass — lockfile up to date | T1–T3 |
| `pnpm vitest run` | pass — 3 files, 33 tests | T1–T3 (re-run by orchestrator as spot check, same result) |
| `pnpm typecheck` | pass — contracts and studio | T1–T3 |
| `pnpm lint` | clean | T1–T3 |
| `gentle-ai review assess` | **medium** (`executable_change` on `.gitignore`), 33 paths / 11273 lines | commit `e877488` |

RDD outcome for `e877488`: **deferred to slice** per the medium tier rule. Base ref for
the next assessment is `e877488`. Empty-tree base `4b825dc…4904` was required for this
first commit because it has no parent.

## Known blockers

**`.env.example` cannot be written.** The sandbox permission policy denies writes to any
`.env*` path. Verified independently by both the writer agent and the orchestrator.
Renaming the file to dodge the rule was rejected as circumvention of a deliberate
boundary. Credential documentation therefore lives in `docs/environment.md` (task T12)
and the user must either grant `.env*` write access or create `.env.example` by hand.

Note for whoever creates it: Sanity's Vite-based CLI only embeds variables prefixed
`SANITY_STUDIO_`, so the Studio needs `SANITY_STUDIO_PROJECT_ID` and
`SANITY_STUDIO_DATASET` in addition to the unprefixed names the backend services read.

## Compute layer (T4–T7)

Built hexagonally: pure domain over ports, vendor SDKs confined to adapters, tests
driven through in-memory fakes rather than SDK mocks. A new shared package
`packages/catalog-core` holds the mapping, idempotency and ports reused by both the
indexer and the reindex worker, so the Sanity-to-`CatalogRecord` mapping exists once.
`packages/contracts` was not modified.

### Sanity webhook signature — ground truth

context7 returned contradictory snippets (header variously `x-sanity-signature`,
`sanity-signature`, `Sanity-Webhook-Signature`; algorithm claimed as both SHA-1 and
SHA-256). The writer resolved it against the published `@sanity/webhook@4.0.4` source
rather than trusting a snippet, and the orchestrator re-verified independently in
`node_modules`:

- header: `sanity-webhook-signature` (exported as `SIGNATURE_HEADER_NAME`)
- algorithm: **SHA-256**, format `t=<ms>,v1=<base64url HMAC of "${ms}.${body}">`

**Finding:** v4.0.4 does not enforce a replay/freshness window despite its own TSDoc
implying one. Clock-skew rejection is therefore implemented as our own domain rule in
`evaluateWebhookRequest`, bounded by `WEBHOOK_MAX_CLOCK_SKEW_MS` (default 300000).

## Contracts the Terraform tasks must honour

- `indexer` event source mapping **must** set `FunctionResponseTypes: ["ReportBatchItemFailures"]`.
  Without it partial-batch reporting is silently ignored and one poison record redrives
  the entire batch into the DLQ.
- `ingest` expects an `APIGatewayProxyEventV2` shape. A Lambda Function URL satisfies it
  with no API Gateway cost.
- `replay` takes no input; wire to manual invoke or an EventBridge schedule.
- `reindex-worker` entrypoint is `node index.cjs`; it exits non-zero on failure so ECS
  marks the task failed.
- Queue body is the raw `IngestMessage` JSON plus an `operation` string message attribute.
- The DLQ replay counter is a custom Number attribute `ReplayCount`, deliberately
  separate from the redrive policy's `maxReceiveCount`: SQS's own
  `ApproximateReceiveCount` does not survive a cross-queue redrive.

### Required Sanity webhook projection

```groq
{
  "documentId": coalesce(after()._id, before()._id),
  "revision":   coalesce(after()._rev, before()._rev),
  "operation":  select(after() == null => "delete", "upsert")
}
```

## Environment variables by service

| Service | Variables |
|---------|-----------|
| ingest | `SANITY_WEBHOOK_SECRET`, `INGEST_QUEUE_URL`, `WEBHOOK_MAX_CLOCK_SKEW_MS` (opt, 300000) |
| indexer | `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_TOKEN` (opt), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_API_KEY`, `ALGOLIA_INDEX_NAME` |
| replay | `DLQ_URL`, `MAIN_QUEUE_URL`, `REPLAY_MAX_ATTEMPTS` (opt, 5), `REPLAY_MAX_MESSAGES_PER_RUN` (opt, 100) |
| reindex-worker | indexer's Sanity/Cloudinary/Algolia vars, plus `REINDEX_MIN_INTERVAL_MS` (opt, 100), `REINDEX_PAGE_SIZE` (opt, 100) |
| studio | `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET` (the `SANITY_STUDIO_` prefix is mandatory for Vite to embed them) |

## Infrastructure (T8–T10)

19 files under `infra/terraform/`, ~1550 lines. Provider pinned `hashicorp/aws ~> 6.0`
(resolved v6.66.0).

### Security fix found while writing it

`.gitignore` covered `*.tfstate*`, `.terraform/` and `.env*` but **not** `*.tfvars`. A
filled-in `terraform.tfvars` holding the Algolia admin key, Cloudinary secret and Sanity
webhook secret would have been committable. Now ignored, with `!*.tfvars.example`
preserved so the template stays tracked. Verified with `git check-ignore`.

### Cost decisions, each commented in place so they are not silently reverted

| Decision | Alternative rejected | Saving |
|---|---|---|
| Public subnets only, Fargate task gets a public IP | NAT Gateway | ~USD 33/month |
| SSM Parameter Store (standard tier) | Secrets Manager, ~USD 0.40 × 10 params | ~USD 4/month |
| `desired_count = 0` on the ECS service | leaving it at 1 | ~USD 9/month |
| Explicit short log retention | CloudWatch default "never expire" | unbounded drift |
| Lambda Function URL for `ingest` | API Gateway | per-request cost |

Idle cost is effectively **USD 0**; the only non-zero lines are cents of ECR image
storage once the worker image is pushed.

### Operational notes

- An ECS **Service** restarts an exited task, so a service is the wrong trigger for a
  one-shot batch. Use `aws ecs run-task` to run a reindex. Commented at the resource.
- `runtime_platform` is pinned `X86_64` to match the Dockerfile's `node:22-alpine`
  build. Building the image on an ARM host requires
  `docker buildx build --platform linux/amd64`, or the task fails at start with an
  exec-format error.
- The SNS email subscription must be confirmed by clicking the emailed link, or every
  alarm fires silently into nothing.
- Main queue visibility timeout is derived as `indexer_lambda_timeout * 6` in
  `locals.tf`, the AWS-recommended ratio, rather than a hardcoded value.

## Storefront and documentation (T11–T12)

Astro 7 static shell with a single React island for search. Docs: `README.md` plus
`docs/{environment,setup,architecture,runbook}.md`.

### Admin-key leak guard — verified by deliberate breakage

Two layers, both wired into `pnpm --filter @vidriera/storefront build` and both
unit-tested:

1. **Pre-build source scan** — rejects any `import.meta.env` / `process.env` reference
   whose name matches `/ADMIN|SECRET|MASTER|WRITE_KEY|_TOKEN\b/i`, *regardless of a
   `PUBLIC_` prefix*. This targets the realistic failure: someone renaming an admin key
   to `PUBLIC_ALGOLIA_ADMIN_API_KEY` to make it reachable in the browser.
2. **Post-build bundle scan** — greps every emitted `dist/` file for the literal value
   of known secret variables, catching a leak that arrived by any other route.

The orchestrator verified layer 1 by injecting
`import.meta.env.PUBLIC_ALGOLIA_ADMIN_API_KEY` into a probe file under
`apps/storefront/src/lib/`. Observed: the guard named the offending file and variable,
the build exited 1, and `astro build` never ran. Probe removed afterwards. A guard that
has never been seen to fire is not a verified guard.

### Swappability proven

`facets.test.ts` builds two different `RubroProfile`s (a bookshop and a plant shop) and
asserts `buildFacetConfig` yields two different, correctly ordered filter sets with
different widget kinds. The filter UI is generated, not hardcoded — which is the whole
point of the rubro profile.

### Stale documentation, again

context7's cached `react-instantsearch` snippets were pre-v7 (they still referenced the
`react-instantsearch-hooks-web` split package and a default `algoliasearch/lite`
export). The writer verified against the actual npm dist for the pinned versions
instead. Ground truth: `react-instantsearch` v7 exports hooks and widgets directly,
`algoliasearch/lite` exports a **named** `liteClient`, and `search()` takes
`{ requests: [...] }` rather than a bare array. This is the second time in this feature
that published documentation disagreed with shipped code.

### Honest trade-off

The search island is ~124 KB gzipped (react + react-instantsearch + algoliasearch/lite).
Every other page is zero-JS static HTML. This is inherent to `react-instantsearch`;
recorded rather than hidden. If it proves too heavy on a slow mobile connection, the
island can be replaced with a direct fetch against the Algolia REST API.

## Independent verification (RDD off-path, high tier)

The user declined the native review for the storefront candidate. A decline drops to the
RDD off path, where a `high` tier requires writer self-verification **plus an
independent verifier**, so one read-only verifier was run against the security-critical
surface only — not the whole 4860-line diff.

It returned `verified` for indexer idempotency and partial-batch reporting, the replay
poison-message counter, and Terraform IAM/SSM least privilege (no wildcard resource ARNs;
secrets correctly classified `SecureString`). It found three real defects, each
re-confirmed by the orchestrator against the actual code before any fix was written.

### D1 — one malformed product name broke the entire static build

`encodeURIComponent` throws `URIError: URI malformed` on a lone UTF-16 surrogate, and
`productos/[slug].astro` called `buildWhatsAppOrderLink` unguarded. With
`output: 'static'` every product page is prerendered at build time, so a single product
whose name picked up a broken character — a bad paste into Sanity, a mangled import —
failed the whole deploy, not just that product.

Fixed with `sanitizeSurrogates`, which strips unpaired surrogates while preserving valid
pairs, so a shop owner typing an emoji into a product name still works. Verified:
emoji intact, lone surrogate does not throw.

### D2 — the admin-key guard could be walked around

`ENV_ACCESS_PATTERN` matched only dot access. Bracket notation, destructuring and
renamed destructuring all produced zero matches. The script also scanned only `src/`
(missing `astro.config.mjs`, where a Vite `define` can inject a secret straight into the
bundle) and only `.ts/.tsx/.astro` (missing `.js`/`.mjs`).

All four closed. The orchestrator independently re-ran the bypass with
`import.meta.env['PUBLIC_ALGOLIA_ADMIN_API_KEY']`: the guard now names the file and the
variable, exits 1, and `astro build` never runs.

**Known gap, deliberately left and pinned by a test:** `const e = import.meta.env;
e.PUBLIC_ADMIN_KEY` cannot be caught reliably by regex. It is documented in a comment
rather than implied to be covered. An honest limit beats a false guarantee.

### D3 — a security comment that was factually false

`sanityWebhookVerifier.ts` claimed `@sanity/webhook` compares signatures timing-safely.
The shipped package does `if (signature !== encoded)`, and `timingSafeEqual` appears
zero times in it.

The signature verification code was deliberately **not** touched. The comment now states
what the dependency actually does and records the accepted tradeoff: a remote timing
attack against an HMAC-SHA256 digest over HTTP is impractical because network jitter
dwarfs the signal, and hand-rolling crypto to close a theoretical gap usually opens a
real one. A comment that lies about a security property is worse than no comment,
because the next reader stops checking.

## Feature status

All twelve tasks are complete, plus the three verifier defects. Final verification,
re-run by the orchestrator:

| Check | Result |
|-------|--------|
| `pnpm vitest run` | **174 passed** (32 files) |
| `pnpm typecheck` | pass — 8 workspace packages |
| `pnpm lint` | clean |
| `terraform validate` | `Success! The configuration is valid.` |
| `terraform fmt -check -recursive` | clean |
| `pnpm --filter @vidriera/storefront build` | pass — 2 pages, both guards green |
| admin-key guard, negative test | **fails the build as designed** |
| `docker build` (reindex worker) | pass — non-root, 242 MB, non-zero exit on failure |

Nothing was deployed. No AWS resource exists yet; no account has been created.

## Remaining work — all of it needs the user

1. Create the four accounts and fill `infra/terraform/terraform.tfvars`, following
   `docs/setup.md`. **The AWS budget alarm at USD 1 comes before the first
   `terraform apply`.**
2. Confirm the SNS subscription email, or every alarm fires into nothing.
3. Decide the `.env*` question: either grant write access so `.env.example` can exist,
   or keep `docs/environment.md` as the credential reference.
4. **Supply the rubro.** Then only `packages/contracts/src/rubro.ts` changes, and the
   Sanity schema, the Algolia facets and the storefront filters all follow from it.

## Next step

Awaiting the rubro. No further code work is queued.
