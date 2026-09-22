# DLQ first: the main queue's redrive_policy references its ARN.
resource "aws_sqs_queue" "dlq" {
  name                      = "${local.name_prefix}-catalog-dlq"
  message_retention_seconds = var.dlq_message_retention_seconds

  tags = { Name = "${local.name_prefix}-catalog-dlq" }
}

resource "aws_sqs_queue" "main" {
  name                       = "${local.name_prefix}-catalog-ingest"
  message_retention_seconds  = var.main_queue_message_retention_seconds
  visibility_timeout_seconds = local.main_queue_visibility_timeout_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.dlq_max_receive_count
  })

  tags = { Name = "${local.name_prefix}-catalog-ingest" }
}

# Kept as a separate resource (rather than an inline redrive_allow_policy
# attribute on aws_sqs_queue.dlq) to avoid a dependency cycle: the DLQ's
# allow-policy needs the main queue's ARN, and the main queue's
# redrive_policy needs the DLQ's ARN. Restricting redrive permission to
# exactly this main queue means nothing else in the account can silently
# start dead-lettering into this DLQ.
resource "aws_sqs_queue_redrive_allow_policy" "dlq" {
  queue_url = aws_sqs_queue.dlq.id

  redrive_allow_policy = jsonencode({
    redrivePermission = "byQueue"
    sourceQueueArns   = [aws_sqs_queue.main.arn]
  })
}
