resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-reindex"

  tags = { Name = "${local.name_prefix}-reindex" }
}

resource "aws_ecs_task_definition" "reindex_worker" {
  family                   = "${local.name_prefix}-reindex-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"

  # Smallest Fargate size available: 0.25 vCPU / 0.5 GB. This is a batch
  # job that walks Sanity documents one page at a time with a throttled
  # write pace (see services/reindex-worker/src/domain/throttle.ts) -- it
  # is I/O-bound waiting on Sanity/Cloudinary/Algolia, not CPU- or
  # memory-bound, so there is nothing to gain from a larger task size.
  cpu    = "256"
  memory = "512"

  execution_role_arn = aws_iam_role.reindex_worker_execution.arn
  task_role_arn      = aws_iam_role.reindex_worker_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "reindex-worker"
      image     = "${aws_ecr_repository.reindex_worker.repository_url}:${var.reindex_worker_image_tag}"
      essential = true

      environment = concat(
        [
          { name = "SANITY_PROJECT_ID", value = aws_ssm_parameter.sanity_project_id.value },
          { name = "SANITY_DATASET", value = aws_ssm_parameter.sanity_dataset.value },
          { name = "CLOUDINARY_CLOUD_NAME", value = aws_ssm_parameter.cloudinary_cloud_name.value },
          { name = "CLOUDINARY_API_KEY", value = aws_ssm_parameter.cloudinary_api_key.value },
          { name = "CLOUDINARY_API_SECRET", value = aws_ssm_parameter.cloudinary_api_secret.value },
          { name = "ALGOLIA_APP_ID", value = aws_ssm_parameter.algolia_app_id.value },
          { name = "ALGOLIA_ADMIN_API_KEY", value = aws_ssm_parameter.algolia_admin_api_key.value },
          { name = "ALGOLIA_INDEX_NAME", value = aws_ssm_parameter.algolia_index_name.value },
          { name = "REINDEX_MIN_INTERVAL_MS", value = tostring(var.reindex_min_interval_ms) },
          { name = "REINDEX_PAGE_SIZE", value = tostring(var.reindex_page_size) },
        ],
        var.sanity_token != "" ? [{ name = "SANITY_TOKEN", value = aws_ssm_parameter.sanity_token[0].value }] : []
      )

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.reindex_worker.name
          "awslogs-region"        = data.aws_region.current.region
          "awslogs-stream-prefix" = "reindex-worker"
        }
      }
    }
  ])

  tags = { Name = "${local.name_prefix}-reindex-worker" }
}

# There is deliberately no standing ECS Service running this task 24/7.
# The reindex-worker is an on-demand batch job (services/reindex-worker/
# src/index.ts exits the process, with a non-zero exit code on failure, the
# moment the walk finishes) -- it is meant to run once and stop, not be
# kept alive.
#
# desired_count defaults to 0 for exactly that reason: a Service's job is
# to keep `desired_count` tasks running and *restart* any that exit, which
# is the wrong behavior for a task that is supposed to exit when it's done.
# Leaving desired_count at 1 would mean ECS restarts the worker in a loop
# forever, at roughly USD 9/month (0.25 vCPU + 0.5 GB Fargate, billed
# continuously) for a full reindex that only ever needs to run occasionally
# and on purpose.
#
# The operationally correct way to trigger a single run is
# `aws ecs run-task --cluster <cluster> --task-definition <family> ...`,
# which starts exactly one task and does not restart it. This aws_ecs_service
# resource exists because task T9 requires a `desired_count` Terraform
# input defaulting to 0; treat scaling it to 1 as a manual, temporary,
# "trigger one run and scale back down" action, not a way to leave the
# worker running.
resource "aws_ecs_service" "reindex_worker" {
  name            = "${local.name_prefix}-reindex-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.reindex_worker.arn
  launch_type     = "FARGATE"
  desired_count   = var.reindex_worker_desired_count

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.reindex_worker.id]
    assign_public_ip = true
  }

  tags = { Name = "${local.name_prefix}-reindex-worker" }
}
