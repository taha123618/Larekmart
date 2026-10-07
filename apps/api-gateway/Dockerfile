# ==============================================================================
# Larekmart - API Gateway Dockerfile (Production Hardened)
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine
ARG BUILD_BASE_IMAGE=larekmart-base-node:latest

# Stage 1: Base build environment pre-configured with pnpm and turbo
FROM ${BUILD_BASE_IMAGE} AS base

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune api-gateway --docker

# Stage 3: Install dependencies and build production assets
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=api-gateway...

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app

# Core runtime environment configurations
ENV NODE_ENV=production \
    PORT=8090 \
    HOST=0.0.0.0

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd fastifyjs || adduser -u 1001 -S -G nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 -G nodejs fastifyjs)
USER fastifyjs

# Copy runtime dependencies and compiled source distribution
COPY --from=installer --chown=fastifyjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=fastifyjs:nodejs /app/packages ./packages
COPY --from=installer --chown=fastifyjs:nodejs /app/apps/api-gateway ./apps/api-gateway

WORKDIR /app/apps/api-gateway

EXPOSE 8090

# Production optimization: Run pure compiled javascript with node
CMD ["node", "dist/index.js"]
