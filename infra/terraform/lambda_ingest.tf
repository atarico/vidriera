resource "aws_lambda_function" "ingest" {
  function_name = "${local.name_prefix}-ingest"
  role          = aws_iam_role.ingest.arn

  filename         = data.archive_file.lambda_zip["ingest"].output_path
  source_code_hash = data.archive_file.lambda_zip["ingest"].output_base64sha256

  # index.js because the archive contains exactly the esbuild output file
  # named "index.js" (see lambda_build.tf); "handler" is the export name
  # from services/ingest/src/handler.ts.
  handler = "index.handler"
  runtime = "nodejs22.x"

  # arm64 (Graviton2): ~20% cheaper per GB-second than x86_64 for the same
  # workload, and esbuild's output is plain JS with no native dependencies,
  # so there is no architecture-specific build concern.
  architectures = ["arm64"]

  timeout     = var.ingest_lambda_timeout_seconds
  memory_size = var.ingest_lambda_memory_mb

  environment {
    variables = {
      SANITY_WEBHOOK_SECRET     = aws_ssm_parameter.sanity_webhook_secret.value
      INGEST_QUEUE_URL          = aws_sqs_queue.main.url
      WEBHOOK_MAX_CLOCK_SKEW_MS = tostring(var.webhook_max_clock_skew_ms)
    }
  }

  depends_on = [aws_cloudwatch_log_group.ingest, aws_iam_role_policy.ingest]

  tags = { Name = "${local.name_prefix}-ingest" }
}

# Function URL, not API Gateway: the handler already expects an
# APIGatewayProxyEventV2 payload, which a Function URL provides natively
# (it uses the same payload format as an HTTP API), and a Function URL has
# no request-based cost at all, where API Gateway bills per request past
# its free tier.
resource "aws_lambda_function_url" "ingest" {
  function_name = aws_lambda_function.ingest.function_name

  # NONE, not AWS_IAM: the caller is Sanity's webhook dispatcher, which
  # cannot sign requests with SigV4. Authenticity is instead enforced by
  # the HMAC signature verification the handler itself performs against
  # SANITY_WEBHOOK_SECRET before accepting anything.
  authorization_type = "NONE"
}
