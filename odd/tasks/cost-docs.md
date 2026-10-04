# Cost docs

## Objective

Publish the monthly running cost of Vidriera for shop owners, with verified sources and
worked examples.

## Problem

`precios/costs.md` holds a cost estimate, but it is untracked, written in English, and
some of its figures are marked unverified. Shop owners reading the README cannot see
what running the platform costs or where the limits are.

## Scope

- Re-verify every figure in `precios/costs.md` against official pricing pages.
- Write `docs/costos.md` in Spanish (neutral, professional): full table, sources, and
  three scenarios (small ~1K visits/month, medium ~3K, high traffic).
- Add a short cost summary to `README.md` that links to `docs/costos.md`.
- Remove `precios/costs.md` once its content lives in `docs/costos.md`.

Out of scope: code or infrastructure changes (search debounce, the CloudFront comment at
`infra/terraform/storefront.tf:75`, the storefront rebuild).

## Constraints

- Documentation only. Non-vital docs may go straight to `main` (user authorization).
- Every figure cites an official source URL and a check date; anything still unverified
  is marked as such.

## Tasks

- [x] T1 Re-verify prices against official sources. Route: delegated (research beyond
  the inline budget). Evidence: every figure checked against official pages or the AWS
  price list JSON on 2026-10-04. Changes: the Algolia attribution only applies after the
  limits are exceeded; SQS, SNS and Fargate ARM prices are now verified; the Boletín
  Oficial link is Resolución 5/2024, not a 2025 notice. The parent re-derived the
  Fargate figure from `infra/terraform/ecs.tf:17-25` (0.25 vCPU + 0.5 GB x86 ≈ USD
  0.0123/hour), which confirms the original ~0.012 estimate.
- [x] T2 Write `docs/costos.md`, update `README.md`, remove `precios/costs.md`. Route:
  delegated writer (2 non-trivial files). Evidence: the relative links resolve
  (`runbook.md#checking-costs` matches `docs/runbook.md:99`), `precios/` is gone, and
  `docs/costos.md` contains no English prose. The parent re-checked the scenario arithmetic
  (Grow overage at USD 0.50 per 1K searches above 10K). Assumptions about delivery size
  and the effect of debounce are marked "supuesto". Cloudinary's behavior above 25
  credits is listed under "Sin verificar".

## Acceptance criteria

- `docs/costos.md` exists in Spanish with a sources table, scenarios, and check date.
- The README has a cost section that links to it.
- No figure lacks a source or an explicit "sin verificar" mark.

## Checks

Passive documentation: structural readback (links resolve, tables render, no leftover
English sections). No runnable test applies.

## Progress

- Complete. Structural readback passed. RDD: passive docs, so no review.

## Next step

None for this feature. A finding for later: at high traffic (~10K visits/month),
Cloudinary delivery may exceed the 25 free credits.
