# ==============================================================================
# Larekmart - Media Service Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/node:20 .

# Stage 1: Base image with package managers for build stages only
FROM ${BASE_IMAGE} AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN pnpm install -g turbo
COPY . .
RUN turbo prune media-service --docker

# Stage 3: Install dependencies
FROM base AS installer
WORKDIR /app
# Sharp ships prebuilt musl binaries; vips/libc6-compat cover edge builds.
RUN apk add --no-cache libc6-compat vips
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter media-service db:generate
RUN pnpm turbo run build --filter=media-service... || true

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install runtime libraries required for Sharp image processing
RUN apk add --no-cache vips

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd honojs || adduser -u 1001 -S -G nodejs honojs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs honojs 2>/dev/null || adduser --system --uid 1001 -G nodejs honojs)
USER honojs

COPY --from=installer --chown=honojs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=honojs:nodejs /app/packages ./packages
COPY --from=installer --chown=honojs:nodejs /app/apps/media-service ./apps/media-service

WORKDIR /app/apps/media-service

EXPOSE 8013

# Migrations run via `node dist/db/migrate.js` before start in deployments.
CMD ["node", "dist/server.js"]
