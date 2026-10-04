# Storefront auto-rebuild

## Objective

Rebuild and redeploy the static storefront automatically whenever the catalog changes in
Algolia, so new products, edits and deletions reach the product pages without a manual
deploy.

## Problem

Product pages are generated once by `astro build`, from Algolia
(`apps/storefront/src/pages/productos/[slug].astro:23`). Nothing rebuilds the site when the
shop owner publishes. A new product appears in search but its page returns 404. A price
change shows in the search card while the product page keeps the old price.

## Why this approach

The user chose option 1, a static rebuild on publish. Migrating to Next.js was rejected:
Astro supports on-demand rendering if that is ever needed, and rendering only on the
client would break the WhatsApp link preview, which needs `og:` tags in static HTML.
GitHub Actions does the build: the repo is public, so minutes are free, no AWS build
infrastructure is needed, and it always builds from `main`. The build reads Algolia, so
the trigger fires **after** the indexer writes, never straight from the Sanity webhook.

## Design

- Port `RebuildTrigger` in `packages/catalog-core/src/ports.ts`. Adapter
  `createGithubRepositoryDispatch` sends `POST /repos/{owner}/{repo}/dispatches` with
  `event_type: catalog-updated`. It takes an injected `fetch` and has a short
  `AbortSignal.timeout`. When the configuration is absent, a no-op trigger is used.
- Indexer: after it computes the batch outcomes, it triggers **once** if any record is
  `indexed` or `deleted`. A trigger failure is logged and never changes
  `batchItemFailures`.
- Reindex worker: it triggers once at the end of `main()`, when `summary.indexed > 0`.
- Workflow `.github/workflows/deploy-storefront.yml`, triggered by `repository_dispatch`
  (`catalog-updated`), `workflow_dispatch`, and `push` to `main` on storefront paths. It
  uses `concurrency` with `cancel-in-progress`. It fails fast when a `PUBLIC_ALGOLIA_*`
  variable is missing, because the build otherwise succeeds and produces an empty site.
  AWS access is through OIDC. Steps: `s3 sync --delete`, then a CloudFront invalidation
  of `/*`.
- Terraform: optional variables `github_dispatch_token` (sensitive) and
  `github_repository`, stored as SSM parameters and passed as Lambda and ECS environment
  variables only when set. Also a GitHub OIDC provider, a deploy role scoped to the
  bucket and the distribution, and outputs for the distribution ID and the role ARN.

## Constraints

- A trigger failure must never fail indexing or the reindex.
- The feature stays off until the token and repository are set, so existing
  deployments keep working.
- No long-lived AWS keys in GitHub.
- Code artifacts are in English. User-facing docs (README, setup) follow the project:
  README in Spanish, `docs/` in English except `docs/costos.md`.

## Tasks

- [x] T1 `RebuildTrigger` port, GitHub dispatch adapter and no-op adapter, with tests.
  Commit `79096ae`. Route: delegated writer. RED was observed first: the module was
  missing, then GREEN.
- [x] T2 Wire the trigger into the indexer handler and the reindex worker, with tests.
  Commit `ea49a34`. Route: delegated writer. RED: the "triggers exactly once" and
  "trigger fails" tests failed first. Checks: `pnpm test` 209 passed (baseline 191),
  `pnpm typecheck` and `pnpm lint` clean. `pnpm format` fails on 36 files that were
  already unformatted on `main`; every touched file is prettier-clean.
- [ ] T3 Terraform: variables, SSM, Lambda and ECS environment, OIDC provider, deploy
  role, outputs, and `terraform.tfvars.example`.
- [ ] T4 GitHub Actions deploy workflow.
- [ ] T5 Docs: `docs/environment.md`, the README Deploy section, `docs/runbook.md`, and
  the setup steps (the fine-grained PAT and the GitHub repository variables).
- [ ] T6 Live verification: apply, publish in Sanity, and see the page update.

## Acceptance criteria

- Publishing or deleting a product in Sanity updates its product page within a few
  minutes, with no manual step.
- Indexer and reindex results are unchanged when GitHub is unreachable or the token is
  wrong.
- A burst of publishes leads to one successful final deploy.

## Checks

`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`, `terraform validate` and
`terraform fmt -check`. T6 is a live check.

## Delivery

Forecast: about 600–700 authored lines, which is over the ~400 budget. The strategy is
`ask-on-risk`. The user chose the chain strategy **stacked-to-main**:

- PR1: T1 and T2, the application code (`feat/storefront-auto-rebuild`).
- PR2: T3, T4 and T5, the infrastructure, the workflow and the docs, on a branch cut
  after PR1 merges. T6 follows the deploy.

Routes: T1 and T2 go to one delegated writer, because the change spans several
non-trivial files in `catalog-core`, the indexer and the reindex worker.

## Progress

- Branch `feat/storefront-auto-rebuild` created from `main` (`3d5625c`).
- Native review of PR1 (`3d5625c..ea49a34`): assessed as medium,
  `slice_budget_reached`. The user granted it. One reliability lens ran and **approved**
  it; lineage `review-207c75296349b5b2`, acknowledged. Two non-blocking findings:
  - `R3-reindex-halfconfig-after-work` (warning): a half-configured token/repository
    pair throws before the reindex starts. Planned for T3: a Terraform validation that
    requires both values or neither, so this state cannot be deployed.
  - `R3-no-env-builder-tests` (suggestion): the env-selection helper is duplicated in
    the indexer and the reindex worker, and neither copy is tested. Follow-up.

## Next step

Push PR1 and open it (the user's decision), then T3–T5 on a new branch after it merges.
