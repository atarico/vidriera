# Architecture

This document explains *why* the system is shaped the way it is. For *what* runs
where, see the README's diagram; for *how to operate it*, see `docs/runbook.md`.

## Why a Lambda indexer but an ECS task for full reindex

Both jobs do fundamentally the same work — map a Sanity document to a
`CatalogRecord` and upsert it into Algolia (`packages/catalog-core`). They run on
different compute for two reasons, not one:

1. **The 15-minute ceiling.** AWS Lambda has a hard 15-minute maximum execution time.
   The `indexer` only ever processes one SQS batch at a time (a handful of documents
   that changed just now), which comfortably fits. A full reindex of every document
   in a Sanity dataset does not have that guarantee — a shop with a few thousand
   products, or a slow run because of rate-limiting (see next point), can run well
   past 15 minutes. ECS Fargate has no such ceiling: a task runs until it exits.

2. **Rate-limiting against Algolia.** A full reindex writing as fast as possible
   would burst far more aggressively against Algolia's write rate limits than the
   normal trickle of individual document changes ever does. `reindex-worker` paces
   itself with `REINDEX_MIN_INTERVAL_MS` between writes
   (`services/reindex-worker/src/domain/throttle.ts`) specifically so a full reindex
   doesn't get itself rate-limited or degrade the index for concurrent searches. A
   Lambda invocation is the wrong shape for a deliberately-slow, long-running job —
   you'd be paying for (and bounded by) a 15-minute execution model for something
   designed to take longer.

The two jobs share `packages/catalog-core`'s mapping and idempotency logic so this
split is an infrastructure decision, not a code duplication.

## Why the reindex-worker is an on-demand task, not a service

An ECS **Service**'s entire job is to keep `desired_count` tasks running and restart
any that exit. A batch job that's *supposed* to exit when it's done is the wrong
workload for a Service — `desired_count = 1` would mean ECS restarts the worker in a
loop forever, burning ~USD 9/month for a job that should run occasionally and on
purpose. `infra/terraform/ecs.tf` sets `desired_count = 0` and the job is triggered
with `aws ecs run-task`, which starts exactly one task and does not restart it. See
`docs/runbook.md` for the actual command — **raising the service's desired count is
not how you trigger a reindex; that starts a service that keeps restarting itself.**

## The dead-letter path, end to end

```
ingest ──▶ main queue ──▶ indexer
                             │
                 fails maxReceiveCount times (default 3)
                             │
                             ▼
                        dead-letter queue (DLQ)
                             │
                 human notices (CloudWatch alarm on DLQ depth > 0)
                             │
                             ▼
                   replay Lambda (manual invoke or schedule)
                             │
                 re-enqueues to the main queue, tagged with
                 a ReplayCount message attribute
                             │
                             ▼
                          indexer (retried)
```

Two details that are easy to get wrong:

- **The redrive counter and the replay counter are deliberately two different
  numbers.** SQS's built-in `ApproximateReceiveCount` drives the redrive policy
  (`maxReceiveCount` in `infra/terraform/queues.tf`), but that count does **not**
  survive a message moving from the DLQ back to the main queue — a redrive resets
  it. `replay` therefore tracks its own `ReplayCount` custom message attribute,
  incremented each time it re-enqueues a message, and stops retrying a message past
  `REPLAY_MAX_ATTEMPTS` (default 5) regardless of what SQS's own counter says. Without
  this, a permanently-broken message (a poison message) would bounce between the
  main queue and the DLQ forever, one redrive cycle at a time.
- **The indexer reports partial batch failures**, not all-or-nothing. The Lambda
  event source mapping sets `FunctionResponseTypes: ["ReportBatchItemFailures"]`
  (`infra/terraform/lambda_indexer.tf`); without it, one poison record in an
  otherwise-healthy batch would redrive the *entire batch*, including records that
  indexed successfully, back toward the DLQ.

## Why idempotency keys off the Sanity `_rev`

Every `CatalogRecord` carries `revision`, populated from the Sanity document's
`_rev` field (`packages/catalog-core/src/idempotency.ts`). SQS is
**at-least-once delivery** — a message can be redelivered (a Lambda timing out after
successfully writing to Algolia but before its SQS delete completes is a completely
ordinary way this happens, not an edge case). Replaying a DLQ message is a second,
deliberate source of possible redelivery on top of that.

`_rev` is the right idempotency key, rather than a wall-clock timestamp or a
monotonic counter we'd have to maintain ourselves, because Sanity already guarantees
it changes on every mutation and stays stable for the *same* mutation replayed twice.
Before writing, the indexer compares the incoming `_rev` against what's already in
Algolia for that `objectID` and skips the write if they match — so processing the
same message twice (from a Lambda retry, a redrive, or a manual replay) converges to
exactly one Algolia object, not a duplicate or a stale overwrite.

## Why the rubro profile is the only swap point

`packages/contracts/src/rubro.ts` is the single file allowed to name a
vertical-specific field or facet — is a hardware store's "material" attribute, a
bookstore's "author," a plant shop's "light needs." Every other layer is *derived*
from a `RubroProfile`, never hardcoded against one:

- **Sanity Studio's schema** builds its product document fields from the profile's
  `attributes` array.
- **Algolia's index settings** (`searchableAttributes`, `attributesForFaceting`) come
  from `packages/contracts/src/derivation.ts`'s pure functions over the profile —
  the same functions the indexer calls when it writes index settings and the
  storefront calls when it builds its facet UI.
- **The storefront's filter sidebar** is generated from
  `attributesForFaceting(profile)` (`apps/storefront/src/lib/facets.ts`) — nothing
  in `apps/storefront` names a specific attribute. A test
  (`apps/storefront/src/lib/facets.test.ts`) proves two different profiles produce
  two different filter sets, which is the actual payoff of this architecture: the
  business's vertical was genuinely unknown when this repository was built (it's
  decided in a following session — see `odd/tasks/catalog-platform.md`), and the plan
  was always to drop in a real profile without touching Studio, the indexer, or the
  storefront.

This is why `docs/setup.md`'s last step is "replace `rubro.ts`" and nothing else.

## Why the storefront never holds an Algolia admin key

The storefront is a **fully static site** — there is no server process at request
time that could hold a privileged credential safely even if we wanted one to. Every
Algolia call the storefront makes, including the build-time product-page generation
in `getStaticPaths` (`apps/storefront/src/pages/productos/[slug].astro`), uses the
same `PUBLIC_ALGOLIA_SEARCH_API_KEY` the browser gets — deliberately, so there is
never a moment in this app's process where a more-privileged key exists to leak. See
`docs/environment.md`'s warning and `apps/storefront/src/lib/envGuard.ts` for the two
build-time guards that enforce this mechanically rather than by convention alone.

## Cost architecture

Idle cost is effectively USD 0/month; see `infra/terraform/*.tf` inline comments for
each decision (no NAT Gateway, SSM standard tier over Secrets Manager,
`desired_count = 0`, short log retention, a Lambda Function URL instead of API
Gateway). The USD 1 budget alarm (`infra/terraform/budget.tf`) is the backstop if
any of those assumptions is ever wrong — see `docs/setup.md`'s first step for why it
is provisioned before anything else, and `docs/runbook.md` for checking actual spend.
