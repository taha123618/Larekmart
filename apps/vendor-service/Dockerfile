# ==============================================================================
# Larekmart - Vendor Service Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:22-alpine
ARG BUILD_BASE_IMAGE=larekmart-base-node:latest

# Stage 1: Base build environment pre-configured with pnpm and turbo
FROM ${BUILD_BASE_IMAGE} AS base

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune vendor-service --docker

# Stage 3: Install dependencies and compile TypeScript
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run db:generate --filter=@repo/vendor-db
RUN pnpm turbo run build --filter=vendor-service...

# Stage 4: Minimal hardened production runner
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd appuser || adduser -u 1001 -S -G nodejs appuser 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs appuser 2>/dev/null || adduser --system --uid 1001 -G nodejs appuser)
USER appuser

COPY --from=installer --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=appuser:nodejs /app/packages ./packages
COPY --from=installer --chown=appuser:nodejs /app/apps/vendor-service ./apps/vendor-service

WORKDIR /app/apps/vendor-service

EXPOSE 8020
CMD ["node", "--import", "tsx", "src/main.ts"]
