# The storefront app itself (T11) is out of scope here; this is only the
# hosting infrastructure it will be deployed into.

resource "aws_s3_bucket" "storefront" {
  # Account ID suffix guarantees a globally-unique bucket name without a
  # random provider resource.
  bucket = "${local.name_prefix}-storefront-${data.aws_caller_identity.current.account_id}"

  tags = { Name = "${local.name_prefix}-storefront" }
}

resource "aws_s3_bucket_public_access_block" "storefront" {
  bucket = aws_s3_bucket.storefront.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Disables ACLs entirely (bucket owner is the sole owner of every object) --
# access is granted exclusively through the bucket policy below, scoped to
# CloudFront's Origin Access Control.
resource "aws_s3_bucket_ownership_controls" "storefront" {
  bucket = aws_s3_bucket.storefront.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# OAC, not the deprecated Origin Access Identity: OAC supports SigV4 for
# all S3 request types (including PUT/DELETE with SSE-KMS) and is AWS's
# current recommendation; OAI is legacy and does not support every S3
# feature CloudFront can otherwise use.
resource "aws_cloudfront_origin_access_control" "storefront" {
  name                              = "${local.name_prefix}-storefront-oac"
  description                       = "OAC for the storefront S3 origin"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# default_root_object only applies to "/". Astro emits every other page as
# <path>/index.html, and the S3 REST origin does not resolve directories, so
# /productos/<slug>/ returned 403 without this rewrite. CloudFront Functions
# are free up to 2M invocations/month, permanently.
resource "aws_cloudfront_function" "storefront_index_rewrite" {
  name    = "${local.name_prefix}-storefront-index-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite directory URIs to their index.html"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) {
        request.uri = uri + 'index.html';
      } else if (uri.split('/').pop().indexOf('.') === -1) {
        request.uri = uri + '/index.html';
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "storefront" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name_prefix} storefront"
  default_root_object = "index.html"

  # PriceClass_100: US/Canada/Europe edge locations only -- cheapest tier,
  # sufficient for a single small local business's customer base, and
  # CloudFront's free tier (1 TB out + 10M requests/month for 12 months)
  # applies regardless of price class.
  price_class = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.storefront.bucket_regional_domain_name
    origin_id                = "storefront-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.storefront.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "storefront-s3"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # AWS managed "CachingOptimized" policy: long TTL, gzip/brotli
    # compression, no cookies/query-string forwarding -- the right default
    # for a static storefront with no per-request personalization.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.storefront_index_rewrite.arn
    }
  }

  # The bucket policy grants s3:GetObject but not s3:ListBucket, so S3
  # answers a missing key with 403, not 404. Serve the site's own 404 page.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # No custom domain configured yet (out of scope for this task); the
  # default *.cloudfront.net certificate is used until a domain is added.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${local.name_prefix}-storefront" }
}

data "aws_iam_policy_document" "storefront_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontServicePrincipalReadOnly"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.storefront.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.storefront.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "storefront" {
  bucket = aws_s3_bucket.storefront.id
  policy = data.aws_iam_policy_document.storefront_bucket_policy.json
}
