output "ingest_function_url" {
  description = "Public Lambda Function URL to configure as the Sanity webhook endpoint."
  value       = aws_lambda_function_url.ingest.function_url
}

output "main_queue_url" {
  description = "SQS URL of the main catalog-ingest queue."
  value       = aws_sqs_queue.main.url
}

output "dlq_url" {
  description = "SQS URL of the dead-letter queue."
  value       = aws_sqs_queue.dlq.url
}

output "replay_function_name" {
  description = "Name of the replay Lambda, for manual invocation (aws lambda invoke --function-name <this>)."
  value       = aws_lambda_function.replay.function_name
}

output "ecr_repository_url" {
  description = "ECR repository URL to push the reindex-worker image to before the first Fargate run."
  value       = aws_ecr_repository.reindex_worker.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name, for `aws ecs run-task --cluster <this> --task-definition <ecs_task_definition_family>`."
  value       = aws_ecs_cluster.main.name
}

output "ecs_task_definition_family" {
  description = "ECS task definition family for the reindex-worker."
  value       = aws_ecs_task_definition.reindex_worker.family
}

output "storefront_bucket_name" {
  description = "S3 bucket name to sync the built storefront into."
  value       = aws_s3_bucket.storefront.id
}

output "storefront_cloudfront_domain_name" {
  description = "CloudFront distribution domain name serving the storefront."
  value       = aws_cloudfront_distribution.storefront.domain_name
}

output "alerts_topic_arn" {
  description = "SNS topic ARN alarms publish to. Confirm the email subscription (a confirmation email is sent on first apply) or alarms will fire silently."
  value       = aws_sns_topic.alerts.arn
}
