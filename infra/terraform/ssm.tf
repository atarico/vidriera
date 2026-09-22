# SSM Parameter Store (standard tier) instead of Secrets Manager: standard
# tier is free (up to 10,000 parameters, well beyond the ~10 this project
# needs), where Secrets Manager bills ~USD 0.40/secret/month -- with ~8
# secret-shaped values across services, that alone would be ~USD 3.20/month
# for a project whose entire budget alarm is set at USD 1.
#
# Every parameter's `value` comes from a Terraform variable with no real
# default (see variables.tf); the values themselves are supplied via
# terraform.tfvars (gitignored) or TF_VAR_* env vars, never committed.
#
# True credentials use SecureString (encrypted at rest with the AWS-managed
# KMS key, still free); plain identifiers that are not secret (a project
# ID, a dataset name, an index name) use String, so a `terraform plan` diff
# and the AWS console don't over-classify non-sensitive config as secret.

resource "aws_ssm_parameter" "sanity_webhook_secret" {
  name  = "${local.ssm_ingest_path_prefix}/SANITY_WEBHOOK_SECRET"
  type  = "SecureString"
  value = var.sanity_webhook_secret

  tags = { Name = "${local.name_prefix}-sanity-webhook-secret" }
}

resource "aws_ssm_parameter" "sanity_project_id" {
  name  = "${local.ssm_indexer_path_prefix}/SANITY_PROJECT_ID"
  type  = "String"
  value = var.sanity_project_id

  tags = { Name = "${local.name_prefix}-sanity-project-id" }
}

resource "aws_ssm_parameter" "sanity_dataset" {
  name  = "${local.ssm_indexer_path_prefix}/SANITY_DATASET"
  type  = "String"
  value = var.sanity_dataset

  tags = { Name = "${local.name_prefix}-sanity-dataset" }
}

# Optional: only created when a token is actually supplied. Both the
# indexer and reindex-worker treat an *absent* SANITY_TOKEN env var
# differently from an empty one (anonymous vs. authenticated Sanity
# client), so this must be conditionally omitted, not set to "".
resource "aws_ssm_parameter" "sanity_token" {
  count = var.sanity_token != "" ? 1 : 0

  name  = "${local.ssm_indexer_path_prefix}/SANITY_TOKEN"
  type  = "SecureString"
  value = var.sanity_token

  tags = { Name = "${local.name_prefix}-sanity-token" }
}

resource "aws_ssm_parameter" "cloudinary_cloud_name" {
  name  = "${local.ssm_indexer_path_prefix}/CLOUDINARY_CLOUD_NAME"
  type  = "String"
  value = var.cloudinary_cloud_name

  tags = { Name = "${local.name_prefix}-cloudinary-cloud-name" }
}

resource "aws_ssm_parameter" "cloudinary_api_key" {
  name  = "${local.ssm_indexer_path_prefix}/CLOUDINARY_API_KEY"
  type  = "SecureString"
  value = var.cloudinary_api_key

  tags = { Name = "${local.name_prefix}-cloudinary-api-key" }
}

resource "aws_ssm_parameter" "cloudinary_api_secret" {
  name  = "${local.ssm_indexer_path_prefix}/CLOUDINARY_API_SECRET"
  type  = "SecureString"
  value = var.cloudinary_api_secret

  tags = { Name = "${local.name_prefix}-cloudinary-api-secret" }
}

resource "aws_ssm_parameter" "algolia_app_id" {
  name  = "${local.ssm_indexer_path_prefix}/ALGOLIA_APP_ID"
  type  = "String"
  value = var.algolia_app_id

  tags = { Name = "${local.name_prefix}-algolia-app-id" }
}

resource "aws_ssm_parameter" "algolia_admin_api_key" {
  name  = "${local.ssm_indexer_path_prefix}/ALGOLIA_ADMIN_API_KEY"
  type  = "SecureString"
  value = var.algolia_admin_api_key

  tags = { Name = "${local.name_prefix}-algolia-admin-api-key" }
}

resource "aws_ssm_parameter" "algolia_index_name" {
  name  = "${local.ssm_indexer_path_prefix}/ALGOLIA_INDEX_NAME"
  type  = "String"
  value = var.algolia_index_name

  tags = { Name = "${local.name_prefix}-algolia-index-name" }
}
