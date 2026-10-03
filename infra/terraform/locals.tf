locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  ssm_ingest_path_prefix  = "/${var.project}/${var.environment}/ingest"
  ssm_indexer_path_prefix = "/${var.project}/${var.environment}/indexer"

  # 6x is the AWS-recommended minimum ratio between an SQS queue's
  # visibility timeout and the timeout of the Lambda consuming it: it
  # guarantees the consumer gets a full timeout's worth of headroom to
  # finish (or fail) before the message could become visible again to a
  # second concurrent receive, which would otherwise cause duplicate
  # processing under load. Computed from the indexer's own timeout rather
  # than hardcoded, so the two can never drift out of the safe ratio.
  main_queue_visibility_timeout_seconds = var.indexer_lambda_timeout_seconds * 6

  repo_root = abspath("${path.module}/../..")
  # Absolute: the bundle step runs from repo_root while archive_file resolves
  # paths from the Terraform working directory, so a relative path diverges.
  build_dir = abspath("${path.module}/dist") # matches the existing "dist/" gitignore entry

  lambda_entrypoints = {
    ingest  = "services/ingest/src/handler.ts"
    indexer = "services/indexer/src/handler.ts"
    replay  = "services/replay/src/handler.ts"
  }

  # Every file that can change what a bundle contains: the service's own
  # source, plus the two shared workspace packages every service depends
  # on, plus the lockfile (a dependency version bump must trigger a
  # rebuild too).
  lambda_watched_globs = [
    "packages/contracts/src/**",
    "packages/catalog-core/src/**",
    "pnpm-lock.yaml",
  ]
}
