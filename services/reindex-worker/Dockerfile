# syntax=docker/dockerfile:1

# --- Builder ------------------------------------------------------------
# Bundles the worker (and its @vidriera/contracts + @vidriera/catalog-core
# workspace dependencies) into a single, dependency-free CommonJS file with
# esbuild. Bundling — rather than tsc + copying node_modules — means the
# runtime stage needs no node_modules at all: no dev dependencies, no
# workspace symlinks, nothing but the compiled script itself.
FROM node:22-alpine AS builder

WORKDIR /repo

# The whole workspace is copied (rather than per-package COPY layers)
# because pnpm's frozen-lockfile install validates every workspace member
# declared in pnpm-workspace.yaml; this project is small enough that the
# simpler, correct approach costs little in cache efficiency.
COPY . .

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vidriera/reindex-worker run build

# --- Runtime --------------------------------------------------------------
FROM node:22-alpine AS runtime

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=builder /repo/services/reindex-worker/dist/index.cjs ./index.cjs

USER app

ENTRYPOINT ["node", "index.cjs"]
