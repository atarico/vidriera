# Feature: Post-deploy hardening

## Objective

Close the defects and loose ends left after the first real AWS deployment of the
catalog platform (`odd/tasks/catalog-platform.md`).

## Problem

JD-1 is open and CRITICAL: a product with a blank or non-ISO `currency` makes
`Intl.NumberFormat` throw. `formatPrice` runs during static prerender (one bad
record fails the whole `astro build`) and in the browser search island (one bad
hit breaks the result list). The site also has no favicon, and the catalog
ledger does not record the deployment.

## Why

This is the third instance of one failure class: untrusted CMS content reaching
a throwing built-in (D1 surrogates, the null `imageSourceUrls`, now currency).
The fix must remove the class at the display boundary, not patch one field.

## Scope

In scope:
- `formatPrice` becomes total: it never throws, whatever `currency` holds.
- Currency is normalized at the indexer mapping boundary (trim, uppercase).
- The Studio validates `currency` as a three-letter ISO 4217 code, default `ARS`.
- A neutral SVG favicon.
- The catalog ledger records the deployment, the seven deploy defects and the
  current external-account state.

Out of scope (needs the user):
- The rubro.
- A strictly search-only Algolia key, a backup MFA device on root.

## Constraints

- No invented default currency in the data path: normalization only cleans what
  the owner typed. The `ARS` default exists only as the Studio initial value.
- Generated artifacts in English.

## Tasks

- [x] T1 — JD-1: total `formatPrice`, mapping normalization, Studio validation.
  Route: delegated writer (3 non-trivial source files plus tests). Commit `600593e`.
- [x] T2 — Favicon. Route: inline (one mechanical file plus a link tag). Commit `b8fd6bc`.
- [x] T3 — Ledger update in `odd/tasks/catalog-platform.md`, plus a "How it works"
  section and live demo link in the README. Route: inline.

## Acceptance criteria

- `formatPrice(1000, '')`, `formatPrice(1000, 'pesos')` and
  `formatPrice(1000, undefined as never)` return a readable price and never throw.
- `pnpm vitest run`, `pnpm typecheck`, `pnpm lint` pass.
- `astro build` succeeds with a record whose currency is invalid.
- The deployed storefront serves `/favicon.svg` and the console shows no 404.

## Verification

`pnpm vitest run`, `pnpm typecheck`, `pnpm lint`, the storefront build, and a
live check after deploy.

## Progress

Created 2026-10-04. All tasks complete.

## Verification evidence

| Check | Result |
|-------|--------|
| RED before T1 | 10 failed, 6 passed (`RangeError: Invalid currency code`, missing normalization) |
| `pnpm vitest run` | 191 passed (32 files) |
| `pnpm typecheck` | pass, every workspace |
| `pnpm lint` | clean |
| storefront build | pass, 3 pages, both secret guards green |
| indexer redeploy | `terraform apply`, only `aws_lambda_function.indexer` modified |
| live site | `/favicon.svg` 200 `image/svg+xml`, browser console 0 errors |
| Studio | deployed to https://vidriera.sanity.studio/ with the currency validation |

Not run: a storefront build against a record with an invalid currency. The live
index holds one valid product, and planting a bad one would need a Studio edit.
`formatPrice` is covered by unit tests over `''`, whitespace, `'pesos'`, `'ARSS'`,
`undefined`, `null` and `42`, and the build and the search island both call it.

The writer added `required()` to the Studio currency field beyond the brief. Kept:
the only existing product already has `ARS`.

Native review: due once the slice reached 529 authored lines since `a3c222a`
(`slice_budget_reached`). The user granted it. One reliability lens ran and approved;
lineage `review-5a56f870dc3d2295`, acknowledged. Two non-blocking findings, left as
follow-ups:

- `R3-cf-rewrite-untested` (warning): the CloudFront index rewrite in
  `infra/terraform/storefront.tf` has no automated test; it was verified only live.
- `R3-currency-empty-string` (suggestion): the mapping stores a missing currency as
  `''`, which the storefront then renders as a plain number.

## Next step

Open the pull request from `feat/catalog-platform` to `main`. The rubro remains with
the user.
