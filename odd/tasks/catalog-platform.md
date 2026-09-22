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
| T8 | Terraform: network, SQS + DLQ redrive, IAM roles | delegated | writer trigger: multiple .tf modules | [ ] |
| T9 | Terraform: Lambdas, ECR, ECS cluster and task definition | delegated | writer trigger: multiple .tf modules | [ ] |
| T10 | Terraform: S3 + CloudFront storefront, CloudWatch alarms, $1 budget | delegated | writer trigger: multiple .tf modules | [ ] |
| T11 | Astro storefront: Algolia InstantSearch, facet UI, WhatsApp order link | delegated | writer trigger: pages + islands + styles | [ ] |
| T12 | Docs: README, architecture diagram, account setup checklist, runbook | delegated | writer trigger: multiple docs | [ ] |

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

## Next step

T8–T10 — Terraform: network, queues with redrive, IAM, Lambdas, ECR, ECS,
S3 + CloudFront, CloudWatch alarms and the USD 1 budget.
