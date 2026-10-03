# ==============================================================================
# Larekmart - Cart Service Dockerfile (Production Optimized)
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
RUN turbo prune cart-service --docker

# Stage 3: Install dependencies and build production assets
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
# Ensure production compilation completes and exits successfully
RUN pnpm turbo run build --filter=cart-service...

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app

# Core runtime environment configurations
ENV NODE_ENV=${NODE_ENV:-production} \
    PORT=${PORT:-8009} \
    MONGO_URI=${MONGO_URI:-mongodb://root:example@mongo:27017/cart_db?authSource=admin}

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd expressjs || adduser -u 1001 -S -G nodejs expressjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs expressjs 2>/dev/null || adduser --system --uid 1001 -G nodejs expressjs)
USER expressjs

# Copy runtime dependencies and compiled source distribution
COPY --from=installer --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=expressjs:nodejs /app/packages ./packages
COPY --from=installer --chown=expressjs:nodejs /app/apps/cart-service ./apps/cart-service

WORKDIR /app/apps/cart-service

EXPOSE 8009

# Production optimization: Run pure compiled javascript with node
CMD ["node", "dist/index.js"]
