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
| T1 | Shared contracts package: catalog record shape + rubro profile type | inline | 1 mechanical file, interface all other tasks depend on | [ ] |
| T2 | Repo scaffold: pnpm workspace, tsconfig, vitest, lint, .gitignore | delegated | writer trigger: 2+ non-trivial files | [ ] |
| T3 | Sanity Studio v5 + vertical-neutral product schema driven by rubro profile | delegated | writer trigger: schema + studio config + desk structure | [ ] |
| T4 | Lambda `ingest`: verify Sanity webhook signature, validate, enqueue to SQS | delegated | writer trigger: handler + domain + tests | [ ] |
| T5 | Lambda `indexer`: SQS consumer, Cloudinary renditions, Algolia upsert, idempotency | delegated | writer trigger: handler + adapters + tests | [ ] |
| T6 | Lambda `replay`: drain DLQ back to the main queue with poison-message guard | delegated | writer trigger: handler + domain + tests | [ ] |
| T7 | ECS worker: throttled full reindex over all Sanity documents + Dockerfile | delegated | writer trigger: worker + throttle + tests + Dockerfile | [ ] |
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

Nothing implemented yet. Scaffold directory and git repository created on branch `main`.

## Verification evidence

None recorded yet.

## Next step

T1 — write the shared contracts package, then start the delegated writers in order.
