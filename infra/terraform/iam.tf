# ---------------------------------------------------------------------------
# Shared assume-role policies
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "ecs_tasks_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "scheduler_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_partition" "current" {}
data "aws_region" "current" {}

# ---------------------------------------------------------------------------
# ingest role: may only send to the main queue, plus write its own logs and
# read its own SSM path (the webhook secret).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "ingest" {
  name               = "${local.name_prefix}-ingest-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = { Name = "${local.name_prefix}-ingest-lambda" }
}

data "aws_iam_policy_document" "ingest" {
  statement {
    sid       = "WriteOwnLogs"
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.ingest.arn}:*"]
  }

  # No wildcard resource ARNs on queue actions: this role can send to the
  # main queue and nothing else.
  statement {
    sid       = "SendToMainQueueOnly"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.main.arn]
  }

  statement {
    sid       = "ReadOwnSsmPath"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:${data.aws_partition.current.partition}:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_ingest_path_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "ingest" {
  name   = "${local.name_prefix}-ingest-policy"
  role   = aws_iam_role.ingest.id
  policy = data.aws_iam_policy_document.ingest.json
}

# ---------------------------------------------------------------------------
# indexer role: may only consume from the main queue (receive/delete/get
# attributes, required by the event source mapping), plus its own logs and
# its own SSM path (Sanity/Cloudinary/Algolia config).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "indexer" {
  name               = "${local.name_prefix}-indexer-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = { Name = "${local.name_prefix}-indexer-lambda" }
}

data "aws_iam_policy_document" "indexer" {
  statement {
    sid       = "WriteOwnLogs"
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.indexer.arn}:*"]
  }

  statement {
    sid       = "ConsumeMainQueueOnly"
    effect    = "Allow"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.main.arn]
  }

  statement {
    sid       = "ReadOwnSsmPath"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:${data.aws_partition.current.partition}:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_indexer_path_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "indexer" {
  name   = "${local.name_prefix}-indexer-policy"
  role   = aws_iam_role.indexer.id
  policy = data.aws_iam_policy_document.indexer.json
}

# ---------------------------------------------------------------------------
# replay role: receive+delete on the DLQ, send on the main queue. No SSM
# access -- replay carries no third-party credentials of its own.
# ---------------------------------------------------------------------------

resource "aws_iam_role" "replay" {
  name               = "${local.name_prefix}-replay-lambda"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json

  tags = { Name = "${local.name_prefix}-replay-lambda" }
}

data "aws_iam_policy_document" "replay" {
  statement {
    sid       = "WriteOwnLogs"
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.replay.arn}:*"]
  }

  statement {
    sid       = "ReceiveDeleteFromDlqOnly"
    effect    = "Allow"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.dlq.arn]
  }

  statement {
    sid       = "SendToMainQueueOnly"
    effect    = "Allow"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.main.arn]
  }
}

resource "aws_iam_role_policy" "replay" {
  name   = "${local.name_prefix}-replay-policy"
  role   = aws_iam_role.replay.id
  policy = data.aws_iam_policy_document.replay.json
}

# ---------------------------------------------------------------------------
# EventBridge Scheduler -> replay Lambda (used only when the schedule is
# enabled; the role itself is harmless to create either way).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "replay_scheduler" {
  name               = "${local.name_prefix}-replay-scheduler"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume_role.json

  tags = { Name = "${local.name_prefix}-replay-scheduler" }
}

data "aws_iam_policy_document" "replay_scheduler" {
  statement {
    sid       = "InvokeReplayOnly"
    effect    = "Allow"
    actions   = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.replay.arn]
  }
}

resource "aws_iam_role_policy" "replay_scheduler" {
  name   = "${local.name_prefix}-replay-scheduler-policy"
  role   = aws_iam_role.replay_scheduler.id
  policy = data.aws_iam_policy_document.replay_scheduler.json
}

# ---------------------------------------------------------------------------
# ECS reindex-worker: an execution role (pulls the image, writes logs -- the
# standard AWS managed policy for this is appropriate here, it never
# touches application data) and a separate, custom, least-privilege task
# role (reads only the indexer's SSM path, same config the indexer Lambda
# reads, since the worker reindexes through the same Sanity/Cloudinary/
# Algolia adapters).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "reindex_worker_execution" {
  name               = "${local.name_prefix}-reindex-worker-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = { Name = "${local.name_prefix}-reindex-worker-execution" }
}

resource "aws_iam_role_policy_attachment" "reindex_worker_execution" {
  role       = aws_iam_role.reindex_worker_execution.name
  policy_arn = "arn:${data.aws_partition.current.partition}:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "reindex_worker_task" {
  name               = "${local.name_prefix}-reindex-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume_role.json

  tags = { Name = "${local.name_prefix}-reindex-worker-task" }
}

data "aws_iam_policy_document" "reindex_worker_task" {
  statement {
    sid       = "ReadIndexerSsmPath"
    effect    = "Allow"
    actions   = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
    resources = ["arn:${data.aws_partition.current.partition}:ssm:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:parameter${local.ssm_indexer_path_prefix}/*"]
  }
}

resource "aws_iam_role_policy" "reindex_worker_task" {
  name   = "${local.name_prefix}-reindex-worker-task-policy"
  role   = aws_iam_role.reindex_worker_task.id
  policy = data.aws_iam_policy_document.reindex_worker_task.json
}
