resource "aws_ecr_repository" "reindex_worker" {
  name                 = "${local.name_prefix}-reindex-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${local.name_prefix}-reindex-worker" }
}

# Every `docker build` without an explicit tag (or a CI rebuild) leaves the
# previous image behind as untagged once the tag moves; without this policy
# those orphaned layers accumulate in ECR storage indefinitely.
resource "aws_ecr_lifecycle_policy" "reindex_worker" {
  repository = aws_ecr_repository.reindex_worker.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}
