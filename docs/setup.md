# Setup checklist

Follow this in order. Steps are ordered so nothing downstream is blocked waiting on
something upstream, **except step 1, which is ordered first for a different reason:
it must exist before you run `terraform apply` even once.**

## 1. AWS budget alarm — before anything else

> [!IMPORTANT]
> Do this **before** step 6 (`terraform apply`), and ideally before creating any other
> AWS resource by hand. The entire cost design of this project (no NAT Gateway,
> `desired_count = 0` on the ECS service, SSM standard tier instead of Secrets
> Manager — see `docs/architecture.md`) assumes idle cost near USD 0, and a budget
> alarm is the backstop if that assumption is ever wrong, including from a mistake
> made while following this checklist.

- [ ] Create an AWS account (or use an existing one) with billing access.
- [ ] Create an IAM user (or role) for Terraform with programmatic access. Least
      privilege isn't practical to hand-enumerate for a stack this shaped
      (VPC, SQS, Lambda, ECS, ECR, S3, CloudFront, IAM, SSM, Budgets, CloudWatch); a
      pragmatic starting point is `AdministratorAccess` on a dedicated IAM user used
      only for this project, rotated/removed when the project is done.
- [ ] Note the access key id and secret; configure them as an AWS CLI profile
      (`aws configure --profile vidriera`) or export
      `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- [ ] The budget alarm itself is provisioned **by Terraform** (`infra/terraform/budget.tf`,
      `aws_budgets_budget.monthly_cap`, `limit_amount = var.budget_limit_usd` — default
      `1` USD) as part of the same `terraform apply` in step 6. There is nothing extra
      to click for the alarm itself — but do not skip straight to step 6: everything
      between here and there sets up the credentials Terraform needs to *succeed*, and
      running `terraform apply` with the budget alarm included is what makes step 6
      safe to run at all.
- [ ] After `terraform apply` runs in step 6, **confirm the SNS email subscription** —
      AWS emails a confirmation link the moment the topic + subscription are created.
      Until you click it, every alarm (including the budget alarm's own notifications)
      fires silently into nothing. This is called out again in step 6 because it's easy
      to miss in the `terraform apply` output.

## 2. Sanity (content)

- [ ] Create a free Sanity account at [sanity.io](https://www.sanity.io).
- [ ] Create a project. Note the **project id**.
- [ ] Create (or use the default) dataset — `production` is assumed throughout this
      repo. Note the **dataset name**.
- [ ] Decide whether the dataset is public or private:
  - Public (simplest): leave `SANITY_TOKEN` unset everywhere.
  - Private: Dashboard → API → Tokens → create a **Viewer** token. This becomes
    `SANITY_TOKEN` for the indexer and reindex-worker (see `docs/environment.md`).
- [ ] Pick a webhook secret yourself — any strong random string
      (`openssl rand -hex 32` works). This becomes `SANITY_WEBHOOK_SECRET`. You will
      enter this same value into the webhook config in step 6, after the ingest
      Lambda's Function URL exists.
- [ ] Deploy the Studio once accounts are wired up:
      `SANITY_STUDIO_PROJECT_ID=... SANITY_STUDIO_DATASET=... pnpm --filter @vidriera/studio run deploy`.

## 3. Algolia (search)

- [ ] Create a free Algolia account at [algolia.com](https://www.algolia.com).
- [ ] Create an application. Note the **Application ID**.
- [ ] Dashboard → API Keys: note the **Admin API Key** (full read/write — this is
      `ALGOLIA_ADMIN_API_KEY`, backend-only, never in the storefront).
- [ ] Create a **second, dedicated key scoped to the `search` ACL only** (or use the
      auto-generated "Search-Only API Key" Algolia provides by default). This becomes
      `PUBLIC_ALGOLIA_SEARCH_API_KEY` — the only Algolia credential the storefront ever
      sees. Do not reuse the admin key here, ever; see `docs/environment.md`'s warning.
- [ ] Decide an index name (e.g. `vidriera_catalog`). Used as both
      `ALGOLIA_INDEX_NAME` (backend) and `PUBLIC_ALGOLIA_INDEX_NAME` (storefront) —
      they must match exactly. You do not need to create the index by hand; the
      indexer creates it on first write, and Terraform's `terraform.tfvars` just
      needs the name.

## 4. Cloudinary (images)

- [ ] Create a free Cloudinary account at [cloudinary.com](https://cloudinary.com).
- [ ] Dashboard home page: note the **Cloud name**, **API Key**, and **API Secret**.

## 5. WhatsApp

- [ ] Get the business's WhatsApp number in full international format (country code,
      no `+`, no spaces — e.g. `5491122334455`; the storefront code strips
      punctuation regardless, but the plain digit form is the least error-prone to
      paste around).
- [ ] If the real number isn't known yet, use a placeholder — nothing else in the
      repo depends on it being real (see `odd/tasks/catalog-platform.md`).

## 6. Infrastructure (Terraform)

- [ ] `cd infra/terraform && cp terraform.tfvars.example terraform.tfvars`
- [ ] Fill in every value from steps 1–4 (`alert_email`, the Sanity/Cloudinary/Algolia
      values). Leave the commented-out optional overrides alone unless you have a
      reason to change them.
- [ ] `terraform init`
- [ ] `terraform validate`
- [ ] `terraform plan` — read it. Confirm there is no NAT Gateway in the plan (there
      should never be one; see `docs/architecture.md`'s cost section) and that
      `aws_budgets_budget.monthly_cap` is present.
- [ ] `terraform apply`
- [ ] **Confirm the SNS email subscription** (see step 1's last item — repeated here
      because this is the moment it actually gets sent).
- [ ] `terraform output ingest_function_url` — configure this URL as the endpoint in
      Sanity's dashboard (Project → API → Webhooks), with the GROQ projection from
      `odd/tasks/catalog-platform.md`'s "Required Sanity webhook projection" section,
      and the same secret you picked in step 2 configured as the webhook's signing
      secret.
- [ ] `terraform output ecr_repository_url` — build and push the reindex-worker image
      before the first `aws ecs run-task` (see `docs/runbook.md`):
      ```bash
      aws ecr get-login-password | docker login --username AWS --password-stdin <ecr_repository_url>
      docker buildx build --platform linux/amd64 -f services/reindex-worker/Dockerfile -t <ecr_repository_url>:latest . --push
      ```
      Run it from the repo root: the build context must be the whole workspace,
      because the Dockerfile installs every pnpm workspace member.
      (`--platform linux/amd64` matters if you're building on an ARM machine — see
      `docs/architecture.md`.)

## 7. Storefront

- [ ] Set the `apps/storefront` environment variables from `docs/environment.md`
      (`PUBLIC_ALGOLIA_APP_ID`, `PUBLIC_ALGOLIA_SEARCH_API_KEY`,
      `PUBLIC_ALGOLIA_INDEX_NAME`, `PUBLIC_WHATSAPP_NUMBER`, `PUBLIC_SITE_URL` —
      `terraform output storefront_cloudfront_domain_name` is a fine starting value
      for the last one before a custom domain exists).
- [ ] `pnpm --filter @vidriera/storefront build`
- [ ] `terraform output storefront_bucket_name` and sync:
      ```bash
      aws s3 sync apps/storefront/dist s3://<storefront_bucket_name> --delete
      ```
- [ ] Invalidate the CloudFront cache so the new build is served immediately instead
      of waiting out the cache TTL:
      ```bash
      aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
      ```
      (Get `<id>` from the AWS console or `aws cloudfront list-distributions`; it
      isn't in `terraform output` today — only the domain name is.)
- [ ] Visit `https://<storefront_cloudfront_domain_name>` and confirm the search page
      loads.

## 8. When the rubro is known

- [ ] Replace the contents of `packages/contracts/src/rubro.ts` with the real
      vertical's attributes and facets. This is the **only** file that should need to
      change — see that file's own header comment and `docs/architecture.md`.
- [ ] Trigger a full reindex so existing Sanity content picks up the new facets (see
      `docs/runbook.md`'s "Trigger a full reindex").
- [ ] Rebuild and redeploy the storefront (step 7) so its facet UI reflects the new
      profile.
