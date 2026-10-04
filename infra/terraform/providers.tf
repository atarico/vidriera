provider "aws" {
  region = var.aws_region

  # default_tags applies Project/Environment/ManagedBy to every taggable
  # resource automatically; resource-specific tags (e.g. Name) are merged
  # on top per-resource rather than repeated here.
  default_tags {
    tags = local.common_tags
  }
}

provider "archive" {}
