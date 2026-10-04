data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${local.name_prefix}-vpc" }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${local.name_prefix}-igw" }
}

# Public subnets only -- there is deliberately NO NAT Gateway anywhere in
# this configuration.
#
# A NAT Gateway costs ~USD 32.85/month in hourly charges alone (730h *
# $0.045/h), before any per-GB data-processing charges, which alone busts
# the "stay inside free tiers" constraint of a solo learning project.
#
# The only workload that runs inside this VPC is the reindex-worker Fargate
# task (Lambda functions are NOT attached to this VPC -- see below), and it
# runs in a public subnet with `assign_public_ip = true` instead of a NAT
# Gateway. A public IP on a 0.25 vCPU / 0.5 GB Fargate task costs nothing
# extra by itself, and the task's compute (~USD 0.01/hour combined) is only
# billed while the batch job is actually running -- desired_count defaults
# to 0 (see ecs.tf), so idle cost here is USD 0.
#
# Lambda functions (ingest, indexer, replay) are intentionally NOT
# configured with a vpc_config at all. Outside a VPC, a Lambda function
# already has outbound internet access through the AWS-managed network
# path with no extra configuration -- putting it in a VPC would gain
# nothing for these functions (they don't need to reach anything VPC-only)
# and is precisely the mistake that leads to "now I need a NAT Gateway so
# my Lambda can reach the internet."
resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.name_prefix}-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${local.name_prefix}-public-rt" }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Outbound-only: the reindex-worker task calls out to Sanity, Cloudinary,
# Algolia and AWS APIs (SSM, ECR, CloudWatch Logs) over HTTPS. It never
# accepts inbound connections, so there is no ingress rule at all.
resource "aws_security_group" "reindex_worker" {
  name_prefix = "${local.name_prefix}-reindex-worker-"
  description = "Outbound-only security group for the reindex-worker Fargate task."
  vpc_id      = aws_vpc.main.id

  egress {
    description = "HTTPS to Sanity, Cloudinary, Algolia and AWS APIs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${local.name_prefix}-reindex-worker-sg" }

  lifecycle {
    create_before_destroy = true
  }
}
