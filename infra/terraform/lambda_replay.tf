resource "aws_lambda_function" "replay" {
  function_name = "${local.name_prefix}-replay"
  role          = aws_iam_role.replay.arn

  filename         = data.archive_file.lambda_zip["replay"].output_path
  source_code_hash = data.archive_file.lambda_zip["replay"].output_base64sha256

  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]

  timeout     = var.replay_lambda_timeout_seconds
  memory_size = var.replay_lambda_memory_mb

  environment {
    variables = {
      DLQ_URL                     = aws_sqs_queue.dlq.url
      MAIN_QUEUE_URL              = aws_sqs_queue.main.url
      REPLAY_MAX_ATTEMPTS         = tostring(var.replay_max_attempts)
      REPLAY_MAX_MESSAGES_PER_RUN = tostring(var.replay_max_messages_per_run)
    }
  }

  depends_on = [aws_cloudwatch_log_group.replay, aws_iam_role_policy.replay]

  tags = { Name = "${local.name_prefix}-replay" }
}

# replay takes no input and is triggered manually (`aws lambda invoke`) or
# on this EventBridge schedule. Disabled by default: an automatic replay
# cadence is only useful once the DLQ pattern has actually been observed in
# practice, and an enabled schedule that nobody is watching yet just adds a
# background process for no benefit.
resource "aws_scheduler_schedule" "replay" {
  name       = "${local.name_prefix}-replay"
  group_name = "default"
  state      = var.replay_schedule_enabled ? "ENABLED" : "DISABLED"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression = var.replay_schedule_expression

  target {
    arn      = aws_lambda_function.replay.arn
    role_arn = aws_iam_role.replay_scheduler.arn
  }
}
