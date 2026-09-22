# Packaging for the three plain-zip Lambdas (ingest, indexer, replay).
#
# These services are TypeScript in a pnpm workspace and depend on the two
# shared workspace packages (@vidriera/contracts, @vidriera/catalog-core).
# Lambda's Node.js runtime cannot resolve pnpm's symlinked workspace
# node_modules layout on its own, so each handler is bundled with esbuild
# into a single, dependency-free CommonJS file first -- the same approach
# services/reindex-worker/Dockerfile already uses for the ECS image, kept
# consistent here rather than inventing a second packaging strategy.
#
# esbuild itself is invoked via `pnpm dlx` (pinned to the same version the
# worker's package.json devDependency uses) rather than added as a
# dependency of ingest/indexer/replay: those services' package.json files
# are out of scope for this change, and `pnpm dlx` needs no workspace
# change to guarantee the same esbuild version everywhere.
locals {
  esbuild_version = "0.28.2"

  lambda_source_hash = {
    for name, entry in local.lambda_entrypoints :
    name => sha1(join("", concat(
      [for f in fileset(local.repo_root, "services/${name}/src/**") : filesha1("${local.repo_root}/${f}")],
      [for g in local.lambda_watched_globs : join("", [for f in fileset(local.repo_root, g) : filesha1("${local.repo_root}/${f}")])],
    )))
  }
}

resource "null_resource" "lambda_bundle" {
  for_each = local.lambda_entrypoints

  triggers = {
    source_hash = local.lambda_source_hash[each.key]
  }

  provisioner "local-exec" {
    working_dir = local.repo_root
    command     = <<-EOT
      set -euo pipefail
      mkdir -p "${local.build_dir}/${each.key}"
      pnpm dlx esbuild@${local.esbuild_version} "${each.value}" \
        --bundle \
        --platform=node \
        --target=node22 \
        --format=cjs \
        --outfile="${local.build_dir}/${each.key}/index.js"
    EOT
  }
}

data "archive_file" "lambda_zip" {
  for_each = local.lambda_entrypoints

  type        = "zip"
  source_dir  = "${local.build_dir}/${each.key}"
  output_path = "${local.build_dir}/${each.key}.zip"

  depends_on = [null_resource.lambda_bundle]
}
