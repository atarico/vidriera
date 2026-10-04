# Runbook

Operational procedures for when something breaks or needs a manual nudge. Assumes
`terraform apply` has already run — every `<...>` placeholder below comes from
`terraform output <name>` (run from `infra/terraform`), named explicitly per command.

## Messages piling up in the DLQ

**Symptom:** the `<name_prefix>-dlq-depth-above-zero` CloudWatch alarm fires (email,
if you confirmed the SNS subscription per `docs/setup.md`), or
`terraform output dlq_url` shows a non-zero `ApproximateNumberOfMessagesVisible`.

**Why this happens:** the `indexer` failed to process a message `maxReceiveCount`
times in a row (default 3 — `infra/terraform/queues.tf`,
`var.dlq_max_receive_count`). Common causes: Sanity or Cloudinary or Algolia was
briefly down, a document has a shape the mapping code doesn't handle, or an
Algolia/Cloudinary credential is wrong or expired.

1. **Look at the actual failures first** — don't replay blind:
   ```bash
   aws logs tail /aws/lambda/<name_prefix>-indexer --since 2h --follow
   ```
   The indexer logs the failing message id and error per record (partial-batch
   reporting — see `docs/architecture.md`). Fix the root cause if it's a credential
   or an outage; if it's a genuinely bad document, fix it in Sanity Studio before
   replaying, or the replay will just fail again and get re-parked.

2. **Check how many messages are actually parked:**
   ```bash
   aws sqs get-queue-attributes \
     --queue-url $(terraform -chdir=infra/terraform output -raw dlq_url) \
     --attribute-names ApproximateNumberOfMessages
   ```

3. **Replay them back to the main queue:**
   ```bash
   aws lambda invoke \
     --function-name $(terraform -chdir=infra/terraform output -raw replay_function_name) \
     --payload '{}' \
     /tmp/replay-output.json
   cat /tmp/replay-output.json
   ```
   `replay` takes no input (see `odd/tasks/catalog-platform.md`'s "Contracts"
   section). It moves up to `REPLAY_MAX_MESSAGES_PER_RUN` (default 100) messages per
   invocation and skips (leaves parked) any message whose own `ReplayCount` custom
   attribute already exceeds `REPLAY_MAX_ATTEMPTS` (default 5) — see
   `docs/architecture.md`'s explanation of why that counter is separate from SQS's
   own receive count. If the DLQ has more than one run's worth of messages, invoke it
   again.

4. **If messages keep getting re-parked after a replay** (same message ids
   reappearing in the DLQ), the underlying cause from step 1 wasn't actually fixed —
   go back and re-check indexer logs and the Sanity document(s) involved. Don't keep
   invoking `replay` on a loop; past `REPLAY_MAX_ATTEMPTS` it stops retrying that
   message on its own and it needs a human decision (fix the document, or delete the
   message from the DLQ deliberately if it's genuinely obsolete).

## Triggering a full reindex

**Use this after:** a bulk content change in Sanity, a rubro profile swap (new
facets need every existing document re-mapped with the new attribute set), or
recovering from an Algolia index that's out of sync for any other reason.

```bash
aws ecs run-task \
  --cluster $(terraform -chdir=infra/terraform output -raw ecs_cluster_name) \
  --task-definition $(terraform -chdir=infra/terraform output -raw ecs_task_definition_family) \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<public-subnet-id>],securityGroups=[<reindex_worker_security_group_id>],assignPublicIp=ENABLED}"
```

> [!IMPORTANT]
> **Use `aws ecs run-task`, never `aws ecs update-service --desired-count 1`.** The
> reindex-worker's ECS **Service** exists only to satisfy a Terraform input; its
> `desired_count` is `0` on purpose. A **Service** restarts any task that exits — and
> `reindex-worker` is *supposed* to exit when the walk finishes. Scaling the service
> up starts the worker, and the moment it finishes and exits, ECS immediately starts
> a brand new one, forever, at ~USD 9/month for a job you likely wanted to run once.
> See `docs/architecture.md` for the full reasoning. `run-task` starts exactly one
> task and does not restart it.

Subnet and security group ids aren't in `terraform output` today (only names/ARNs of
the higher-level resources are) — get them with:
```bash
terraform -chdir=infra/terraform state show 'aws_subnet.public[0]'
terraform -chdir=infra/terraform state show 'aws_security_group.reindex_worker'
```

**Before the very first run ever**, the reindex-worker's Docker image needs to exist
in ECR (`docs/setup.md`, step 6, has the build/push commands).

**Watch it run:**
```bash
aws logs tail /ecs/<name_prefix>-reindex-worker --since 5m --follow
```
A failed or non-zero-exit task fires the `<name_prefix>-reindex-worker-task-failed`
EventBridge-driven alarm to the same SNS topic as everything else.

## Checking costs

- **Quick sanity check** — is the budget alarm's actual number reasonable:
  ```bash
  aws budgets describe-budget \
    --account-id $(aws sts get-caller-identity --query Account --output text) \
    --budget-name <name_prefix>-monthly-cap
  ```
- **Where the money is actually going**, month to date:
  ```bash
  aws ce get-cost-and-usage \
    --time-period Start=$(date +%Y-%m-01),End=$(date -I) \
    --granularity MONTHLY \
    --metrics UnblendedCost \
    --group-by Type=DIMENSION,Key=SERVICE
  ```
- **If it's non-zero and you don't know why**, the likeliest culprits given this
  stack's cost design (`docs/architecture.md`) are: the reindex-worker's ECS service
  got scaled up and left running (see the warning above — check
  `aws ecs describe-services --cluster <ecs_cluster_name> --services <name_prefix>-reindex-worker`
  and confirm `desiredCount` is back to `0`), or ECR image storage for pushed
  reindex-worker images accumulating (delete old tags you don't need).
- **If you never confirmed the SNS email subscription** (`docs/setup.md`, step 1),
  you will not hear about any of this until you check manually. Go confirm it.

## The Sanity webhook stops delivering

1. Sanity dashboard → Project → API → Webhooks → check the webhook's recent delivery
   attempts and response codes.
2. A `401`/`403` almost always means `SANITY_WEBHOOK_SECRET` doesn't match between
   Sanity's webhook config and the `ingest` Lambda's environment (SSM parameter
   `/{project}/{environment}/ingest/SANITY_WEBHOOK_SECRET`).
3. Check the ingest Lambda directly:
   ```bash
   aws logs tail /aws/lambda/<name_prefix>-ingest --since 1h --follow
   ```
4. If the endpoint URL itself changed (rare — a Function URL is stable across
   deploys unless the Lambda is recreated), re-fetch it with
   `terraform output ingest_function_url` and update the webhook config.
