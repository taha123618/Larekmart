# ==============================================================================
# Larekmart - Wishlist Service Dockerfile
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
RUN turbo prune wishlist-service --docker

# Stage 3: Install dependencies and compile TypeScript
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=wishlist-service...

# Stage 4: Minimal hardened production runner
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd fastifyjs || adduser -u 1001 -S -G nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 -G nodejs fastifyjs)
USER fastifyjs

COPY --from=installer --chown=fastifyjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=fastifyjs:nodejs /app/packages ./packages
COPY --from=installer --chown=fastifyjs:nodejs /app/apps/wishlist-service ./apps/wishlist-service

WORKDIR /app/apps/wishlist-service

EXPOSE 8015
CMD ["node", "--import", "tsx", "src/index.ts"]
