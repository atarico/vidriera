variable "project" {
  type        = string
  description = "Short project name used as a prefix for every resource name and as a default tag."
  default     = "vidriera"
}

variable "environment" {
  type        = string
  description = "Deployment environment name (e.g. dev, prod). Used as a resource-name and SSM-path suffix."
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region to deploy into."
  default     = "us-east-1"
}

variable "alert_email" {
  type        = string
  description = "Email address that receives the budget alarm and the CloudWatch operational alarms (DLQ depth, indexer error rate, worker task failure)."
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC. Only the reindex-worker Fargate task runs inside it."
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for the public subnets (one per AZ). No private subnets and no NAT Gateway exist in this configuration."
  default     = ["10.20.0.0/20", "10.20.16.0/20"]
}

# ---------------------------------------------------------------------------
# Queues
# ---------------------------------------------------------------------------

variable "dlq_max_receive_count" {
  type        = number
  description = "Number of times a message may be received from the main queue before SQS moves it to the DLQ."
  default     = 3
}

variable "main_queue_message_retention_seconds" {
  type        = number
  description = "How long an unconsumed message survives in the main queue (default: 4 days)."
  default     = 345600
}

variable "dlq_message_retention_seconds" {
  type        = number
  description = "How long a parked message survives in the DLQ (default: 14 days -- the SQS maximum), giving time to investigate before it is lost."
  default     = 1209600
}

# ---------------------------------------------------------------------------
# Lambda: ingest
# ---------------------------------------------------------------------------

variable "ingest_lambda_timeout_seconds" {
  type        = number
  description = "Timeout for the ingest Lambda (signature verification + SQS enqueue only, so this stays small)."
  default     = 10
}

variable "ingest_lambda_memory_mb" {
  type        = number
  description = "Memory (MB) for the ingest Lambda."
  default     = 128
}

variable "webhook_max_clock_skew_ms" {
  type        = number
  description = "Maximum allowed clock skew (ms) between the Sanity webhook signature timestamp and Lambda invocation time."
  default     = 300000
}

# ---------------------------------------------------------------------------
# Lambda: indexer
# ---------------------------------------------------------------------------

variable "indexer_lambda_timeout_seconds" {
  type        = number
  description = "Timeout for the indexer Lambda. Drives the main queue's visibility timeout (set to 6x this value, the AWS-recommended ratio)."
  default     = 60
}

variable "indexer_lambda_memory_mb" {
  type        = number
  description = "Memory (MB) for the indexer Lambda."
  default     = 256
}

variable "indexer_batch_size" {
  type        = number
  description = "Maximum number of SQS messages delivered to the indexer per invocation."
  default     = 10
}

# ---------------------------------------------------------------------------
# Lambda: replay
# ---------------------------------------------------------------------------

variable "replay_lambda_timeout_seconds" {
  type        = number
  description = "Timeout for the replay Lambda."
  default     = 60
}

variable "replay_lambda_memory_mb" {
  type        = number
  description = "Memory (MB) for the replay Lambda."
  default     = 128
}

variable "replay_max_attempts" {
  type        = number
  description = "Maximum number of times replay will redrive the same DLQ message before leaving it parked for human attention."
  default     = 5
}

variable "replay_max_messages_per_run" {
  type        = number
  description = "Maximum number of DLQ messages drained per replay invocation."
  default     = 100
}

variable "replay_schedule_enabled" {
  type        = bool
  description = "Whether the EventBridge schedule that triggers replay automatically is enabled. Defaults to disabled: replay is invoked manually until the DLQ pattern has been observed in practice."
  default     = false
}

variable "replay_schedule_expression" {
  type        = string
  description = "EventBridge Scheduler rate/cron expression for the automatic replay trigger (only used when replay_schedule_enabled is true)."
  default     = "rate(1 day)"
}

# ---------------------------------------------------------------------------
# ECS reindex-worker
# ---------------------------------------------------------------------------

variable "reindex_worker_image_tag" {
  type        = string
  description = "Tag of the reindex-worker image in ECR to run. Pushing a new image with this tag and re-applying updates the task definition."
  default     = "latest"
}

variable "reindex_worker_desired_count" {
  type        = number
  description = "Desired task count for the reindex-worker ECS service. Defaults to 0: this is an on-demand batch job, not a standing service -- leaving it at 1 would run (and re-run, since a Service restarts an exited task) the worker continuously for no reason, at roughly USD 9/month. Prefer `aws ecs run-task` for a single on-demand run over raising this value."
  default     = 0
}

variable "reindex_min_interval_ms" {
  type        = number
  description = "Minimum milliseconds between reindex-worker writes, pacing calls to stay under Algolia's rate limits."
  default     = 100
}

variable "reindex_page_size" {
  type        = number
  description = "Number of Sanity documents fetched per page during a full reindex."
  default     = 100
}

# ---------------------------------------------------------------------------
# Observability / cost guard
# ---------------------------------------------------------------------------

variable "log_retention_days" {
  type        = number
  description = "CloudWatch Logs retention for every log group in this stack. CloudWatch's own default is 'never expire', which silently accrues storage cost forever -- this stack always sets an explicit, short retention."
  default     = 14
}

variable "budget_limit_usd" {
  type        = string
  description = "Monthly AWS Budgets limit, in USD, as a string (the aws_budgets_budget resource expects limit_amount as a string)."
  default     = "1"
}

# ---------------------------------------------------------------------------
# Secrets (SSM Parameter Store, standard tier -- free)
#
# Every value below is a Terraform *variable*: it has no real default (or,
# for sanity_token, an empty-string default meaning "omit"), and the actual
# value is supplied at apply time via terraform.tfvars (gitignored) or
# TF_VAR_* environment variables -- never committed. See
# terraform.tfvars.example for the full list an operator must fill in.
# ---------------------------------------------------------------------------

variable "sanity_webhook_secret" {
  type        = string
  description = "Shared secret configured on the Sanity webhook, used to verify its HMAC signature in the ingest Lambda."
  sensitive   = true
}

variable "sanity_project_id" {
  type        = string
  description = "Sanity project ID (not secret, but kept in SSM alongside the values it's read together with)."
}

variable "sanity_dataset" {
  type        = string
  description = "Sanity dataset name, e.g. 'production'."
}

variable "sanity_token" {
  type        = string
  description = "Optional Sanity read token. Leave empty (default) for a public dataset -- the indexer and reindex-worker then read anonymously."
  sensitive   = true
  default     = ""
}

variable "cloudinary_cloud_name" {
  type        = string
  description = "Cloudinary cloud name (not secret)."
}

variable "cloudinary_api_key" {
  type        = string
  description = "Cloudinary API key."
  sensitive   = true
}

variable "cloudinary_api_secret" {
  type        = string
  description = "Cloudinary API secret."
  sensitive   = true
}

variable "algolia_app_id" {
  type        = string
  description = "Algolia application ID (not secret)."
}

variable "algolia_admin_api_key" {
  type        = string
  description = "Algolia admin API key (write access -- required by the indexer and reindex-worker to upsert records)."
  sensitive   = true
}

variable "algolia_index_name" {
  type        = string
  description = "Algolia index name the indexer and reindex-worker write to."
}
