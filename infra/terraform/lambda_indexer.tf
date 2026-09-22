resource "aws_lambda_function" "indexer" {
  function_name = "${local.name_prefix}-indexer"
  role          = aws_iam_role.indexer.arn

  filename         = data.archive_file.lambda_zip["indexer"].output_path
  source_code_hash = data.archive_file.lambda_zip["indexer"].output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  timeout     = var.indexer_lambda_timeout_seconds
  memory_size = var.indexer_lambda_memory_mb

  environment {
    variables = merge(
      {
        SANITY_PROJECT_ID     = aws_ssm_parameter.sanity_project_id.value
        SANITY_DATASET        = aws_ssm_parameter.sanity_dataset.value
        CLOUDINARY_CLOUD_NAME = aws_ssm_parameter.cloudinary_cloud_name.value
        CLOUDINARY_API_KEY    = aws_ssm_parameter.cloudinary_api_key.value
        CLOUDINARY_API_SECRET = aws_ssm_parameter.cloudinary_api_secret.value
        ALGOLIA_APP_ID        = aws_ssm_parameter.algolia_app_id.value
        ALGOLIA_ADMIN_API_KEY = aws_ssm_parameter.algolia_admin_api_key.value
        ALGOLIA_INDEX_NAME    = aws_ssm_parameter.algolia_index_name.value
      },
      # SANITY_TOKEN is set only when the operator supplied one: an absent
      # env var (anonymous Sanity client) is behaviorally different from an
      # empty-string one, so this must be an actual omission, not "".
      var.sanity_token != "" ? { SANITY_TOKEN = aws_ssm_parameter.sanity_token[0].value } : {}
    )
  }

  depends_on = [aws_cloudwatch_log_group.indexer, aws_iam_role_policy.indexer]

  tags = { Name = "${local.name_prefix}-indexer" }
}

# The single most important line in this whole configuration.
#
# Without function_response_types = ["ReportBatchItemFailures"], a batch
# failure response from the handler is silently ignored by the event
# source mapping: SQS then treats the *entire batch* as failed and, once
# maxReceiveCount is hit, redrives every message in it -- including the
# ones that indexed successfully -- into the DLQ alongside the one poison
# record that actually failed. With it, the handler's own
# batchItemFailures array (built in domain/buildBatchItemFailures.ts) tells
# SQS exactly which message IDs to retry, and only those are ever
# redriven.
resource "aws_lambda_event_source_mapping" "indexer" {
  event_source_arn = aws_sqs_queue.main.arn
  function_name    = aws_lambda_function.indexer.arn
  batch_size       = var.indexer_batch_size

  function_response_types = ["ReportBatchItemFailures"]
}
