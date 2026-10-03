# ==============================================================================
# Larekmart - Shipping Service Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine
ARG BUILD_BASE_IMAGE=larekmart-base-node:latest
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/node:20 .

# Stage 1: Base build environment pre-configured with pnpm and turbo
FROM ${BUILD_BASE_IMAGE} AS base

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune shipping-service --docker

# Stage 3: Install dependencies and generate Prisma clients
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm --filter @repo/shipping-db db:generate
RUN pnpm turbo run build --filter=shipping-service...

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd koajs || adduser -u 1001 -S -G nodejs koajs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs koajs 2>/dev/null || adduser --system --uid 1001 -G nodejs koajs)
USER koajs

COPY --from=installer --chown=koajs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=koajs:nodejs /app/packages ./packages
COPY --from=installer --chown=koajs:nodejs /app/apps/shipping-service ./apps/shipping-service

WORKDIR /app/apps/shipping-service

EXPOSE 8011
CMD ["node", "--import", "tsx", "src/index.ts"]
