# CloudWatch Logs' own default retention is "never expire", which quietly
# accrues storage cost forever. Every log group in this stack sets an
# explicit, short retention instead (log_retention_days, default 14).
#
# Log groups are declared here (ahead of the functions that write to them)
# so each Lambda's own IAM policy can scope logs:PutLogEvents to its exact
# log group ARN instead of a wildcard.

resource "aws_cloudwatch_log_group" "ingest" {
  name              = "/aws/lambda/${local.name_prefix}-ingest"
  retention_in_days = var.log_retention_days

  tags = { Name = "${local.name_prefix}-ingest-logs" }
}

resource "aws_cloudwatch_log_group" "indexer" {
  name              = "/aws/lambda/${local.name_prefix}-indexer"
  retention_in_days = var.log_retention_days

  tags = { Name = "${local.name_prefix}-indexer-logs" }
}

resource "aws_cloudwatch_log_group" "replay" {
  name              = "/aws/lambda/${local.name_prefix}-replay"
  retention_in_days = var.log_retention_days

  tags = { Name = "${local.name_prefix}-replay-logs" }
}

resource "aws_cloudwatch_log_group" "reindex_worker" {
  name              = "/ecs/${local.name_prefix}-reindex-worker"
  retention_in_days = var.log_retention_days

  tags = { Name = "${local.name_prefix}-reindex-worker-logs" }
}

# ---------------------------------------------------------------------------
# Alerting: one SNS topic, email subscription, used by every alarm and by
# the ECS task-failure EventBridge rule below.
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = { Name = "${local.name_prefix}-alerts" }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ---------------------------------------------------------------------------
# Alarm 1: DLQ depth above zero. Any message in the DLQ means something
# failed maxReceiveCount times and needs human attention (or a replay run).
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "dlq_depth" {
  alarm_name          = "${local.name_prefix}-dlq-depth-above-zero"
  alarm_description   = "The dead-letter queue has at least one parked message."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.dlq.name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = { Name = "${local.name_prefix}-dlq-depth-above-zero" }
}

# ---------------------------------------------------------------------------
# Alarm 2: indexer error rate. A metric-math expression (errors / invocations
# * 100) rather than a raw error count, so it reflects a genuine rate and
# doesn't fire from one-off transient errors on a quiet queue.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "indexer_error_rate" {
  alarm_name          = "${local.name_prefix}-indexer-error-rate"
  alarm_description   = "The indexer Lambda's error rate exceeds 10% of invocations over 5 minutes."
  evaluation_periods  = 1
  comparison_operator = "GreaterThanThreshold"
  threshold           = 10
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "(errors / invocations) * 100"
    label       = "Indexer error rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Errors"
      dimensions  = { FunctionName = aws_lambda_function.indexer.function_name }
      period      = 300
      stat        = "Sum"
    }
  }

  metric_query {
    id = "invocations"
    metric {
      namespace   = "AWS/Lambda"
      metric_name = "Invocations"
      dimensions  = { FunctionName = aws_lambda_function.indexer.function_name }
      period      = 300
      stat        = "Sum"
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]

  tags = { Name = "${local.name_prefix}-indexer-error-rate" }
}

# ---------------------------------------------------------------------------
# Alarm 3: worker task failure. There is no standing ECS Service metric that
# means "a batch task failed" (no service-level running-count drift to
# watch, since desired_count is normally 0), so this is driven by an
# EventBridge rule on ECS Task State Change events instead of a metric
# alarm: it matches a STOPPED task in this cluster whose container exited
# non-zero or that failed to start at all.
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_event_rule" "reindex_worker_task_failed" {
  name        = "${local.name_prefix}-reindex-worker-task-failed"
  description = "Fires when a reindex-worker Fargate task stops with a non-zero exit code or fails to start."

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn = [aws_ecs_cluster.main.arn]
      lastStatus = ["STOPPED"]
      stopCode   = ["TaskFailedToStart", "EssentialContainerExited"]
      containers = {
        exitCode = [{ "anything-but" : 0 }]
      }
    }
  })

  tags = { Name = "${local.name_prefix}-reindex-worker-task-failed" }
}

resource "aws_cloudwatch_event_target" "reindex_worker_task_failed_sns" {
  rule      = aws_cloudwatch_event_rule.reindex_worker_task_failed.name
  target_id = "sns-alerts"
  arn       = aws_sns_topic.alerts.arn
}

resource "aws_sns_topic_policy" "alerts_allow_eventbridge" {
  arn = aws_sns_topic.alerts.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgePublish"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.alerts.arn
        Condition = {
          ArnEquals = { "aws:SourceArn" = aws_cloudwatch_event_rule.reindex_worker_task_failed.arn }
        }
      }
    ]
  })
}
