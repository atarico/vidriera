# Vidriera

A free-to-run online catalog for a small local business: faceted product search and
one-tap WhatsApp ordering, with **no checkout, no commission, and no monthly fee**.
It's a straight alternative to paying Tienda Nube a subscription or Mercado Libre a
cut of every sale, for a shop that just needs people to find a product and message
the owner about it.

The catalog's vertical ("rubro" — a hardware store, a bakery, a plant shop, anything)
is not baked into the code. It is supplied by editing one file,
[`packages/contracts/src/rubro.ts`](packages/contracts/src/rubro.ts), and every schema
field, search filter, and facet in the system follows from it automatically.

## The 30-second version

A shop owner edits products in a **Sanity Studio**. Saving a product fires a webhook
that lands the change in **Algolia**, with images optimized through **Cloudinary**,
usually within a few seconds. Customers find products on a static **Astro storefront**
hosted for pennies on **S3 + CloudFront**, filter by whatever facets the rubro profile
defines, and tap a product to open WhatsApp with a prefilled message. There is no
server serving customer traffic — the storefront is static HTML, and the only compute
that ever runs is short-lived AWS Lambda functions reacting to content changes.

```
┌──────────────┐  webhook   ┌────────┐  SQS   ┌─────────┐  upsert   ┌─────────┐
│ Sanity Studio │──────────▶│ ingest │───────▶│ indexer │──────────▶│ Algolia │
│ (content edit)│  (Lambda) │(Lambda)│ (queue)│ (Lambda)│ (Cloudinary│ (search │
└──────────────┘            └────────┘        └────┬────┘  images)  │  index) │
                                                     │ fails         └────┬────┘
                                                     │ maxReceiveCount    │
                                                     ▼                    │
                                              ┌─────────────┐            │
                                              │     DLQ     │            │
                                              │ (parked msg)│            │
                                              └──────┬──────┘            │
                                                      │ manual/scheduled │
                                                      ▼                  │
                                                ┌──────────┐             │
                                                │  replay  │─────────────┘
                                                │ (Lambda) │  back to main queue
                                                └──────────┘

┌──────────────────┐  throttled full walk   ┌─────────┐
│  reindex-worker   │───────────────────────▶│ Algolia │   (ECS Fargate, on demand —
│ (ECS Fargate task) │                        └─────────┘    not a 24/7 service)
└────────────────────┘

┌───────────┐  live search   ┌──────────────────┐
│  Customer  │◀──────────────▶│ Astro storefront  │  (static, S3 + CloudFront,
│  (phone)   │  tap → WhatsApp│  + React island   │   search-only Algolia key)
└───────────┘                └───────────────────┘
```

Why it's shaped this way — including why the indexer is a Lambda but the bulk
reindex is an ECS task, and why replay exists at all — is covered in
[`docs/architecture.md`](docs/architecture.md).

## Repository layout

| Path | What it is |
|------|------------|
| `packages/contracts` | Shared types (`CatalogRecord`, `RubroProfile`) and the pure derivation functions everything else is built on. **The one file to edit for a new vertical: `src/rubro.ts`.** |
| `packages/catalog-core` | Hexagonal domain logic shared by the indexer and the reindex worker (mapping, idempotency, Algolia/Cloudinary/Sanity adapters). |
| `apps/studio` | Sanity Studio v6 — where the shop owner edits products. |
| `apps/storefront` | The public Astro + React storefront customers browse. |
| `services/ingest` | Lambda: verifies the Sanity webhook signature, enqueues to SQS. |
| `services/indexer` | Lambda: consumes the queue, derives images via Cloudinary, upserts into Algolia. |
| `services/replay` | Lambda: drains the dead-letter queue back to the main queue. |
| `services/reindex-worker` | ECS Fargate task: throttled full reindex of every Sanity document. |
| `infra/terraform` | All AWS infrastructure, including the USD 1 budget alarm. |
| `docs/` | Credential reference, account setup checklist, architecture rationale, operational runbook. |

## Running it locally

Requires Node ≥22.12 and pnpm (see `package.json`'s `packageManager` field for the
exact pinned version — `corepack enable` will pick it up automatically).

```bash
pnpm install
pnpm test          # pnpm vitest run — all unit tests, no AWS/Sanity/Algolia account needed
pnpm typecheck
pnpm lint
```

To run a single app:

```bash
pnpm --filter @vidriera/studio dev        # Sanity Studio, needs SANITY_STUDIO_* vars
pnpm --filter @vidriera/storefront dev    # Astro storefront, needs PUBLIC_ALGOLIA_* vars
pnpm --filter @vidriera/storefront build  # static production build
```

**No `.env` file ships in this repo** (the sandbox this project was built in refuses to
write one, and it would be the wrong place for secrets anyway once real accounts exist).
Every variable any service reads — what it's for, where to get it, and whether it's a
secret — is documented in [`docs/environment.md`](docs/environment.md). Without any
environment variables set, the storefront still builds successfully: it renders a
"not configured yet" state instead of crashing, which is exactly what this repository
ships with today (see "What's left to do," below).

## Deploying

Three things deploy independently:

1. **Sanity Studio** — `pnpm --filter @vidriera/studio deploy` (needs a Sanity
   account; hosted on Sanity's own infrastructure, free).
2. **Infrastructure** — `terraform apply` from `infra/terraform`, after filling in
   `terraform.tfvars` (copy from `terraform.tfvars.example`). Provisions the queues,
   Lambdas, ECS cluster, and the S3 + CloudFront storefront hosting.
3. **Storefront static build** — `pnpm --filter @vidriera/storefront build`, then
   `aws s3 sync apps/storefront/dist s3://<storefront_bucket_name> --delete` followed
   by a CloudFront invalidation. Bucket name and distribution ID come from
   `terraform output`.

The full, ordered account-creation and deploy checklist — starting with the budget
alarm, before any `terraform apply` — is in [`docs/setup.md`](docs/setup.md).
Day-two operations (DLQ replay, full reindex, cost checks) are in
[`docs/runbook.md`](docs/runbook.md).

## What's left to do

This repository was built before any of the external accounts (Sanity, Algolia,
Cloudinary, AWS) existed and before the business's actual vertical was decided — see
`odd/tasks/catalog-platform.md`'s "Blocked on user" section. Nothing in the code
depends on real credentials to build or test; deploying against a real shop does:

- Create the four accounts and the AWS budget alarm — [`docs/setup.md`](docs/setup.md).
- Replace `packages/contracts/src/rubro.ts` with the business's actual vertical
  (fields, facets) once it's decided. No other file needs to change.
- Set a real `PUBLIC_WHATSAPP_NUMBER` and `PUBLIC_SITE_URL` for the storefront.
- Run `terraform apply`, deploy the Studio, and build + sync the storefront.
