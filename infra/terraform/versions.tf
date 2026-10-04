# Provider versions are pinned to a major version (not an exact patch) so
# `terraform init` can pick up bug fixes without a config change, while a
# breaking major-version upgrade (argument renames, deprecations) always
# requires a deliberate edit here.
terraform {
  required_version = ">= 1.16.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  # Local state by default: this is a solo learning project, and an S3
  # backend needs a bootstrap bucket + DynamoDB lock table that would
  # themselves have to be created by *something* first -- a chicken-and-egg
  # problem not worth solving for a single operator on a single machine.
  #
  # Switch to remote state (uncomment below, after creating the bucket and
  # lock table by hand or in a separate bootstrap root) the moment a second
  # person or a CI pipeline needs to run `terraform apply`: local state has
  # no locking, so two concurrent applies can corrupt each other's state,
  # and the state file (which contains resource IDs and, for this project,
  # secret values read from tfvars) only lives on whichever machine last
  # applied it.
  #
  # backend "s3" {
  #   bucket         = "vidriera-terraform-state"
  #   key            = "catalog-platform/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "vidriera-terraform-locks"
  #   encrypt        = true
  # }
}
