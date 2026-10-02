# ==============================================================================
# Larekmart - Order Service Dockerfile (Production Optimized)
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine

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
RUN turbo prune order-service --docker

# Stage 3: Install dependencies and build production assets
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
# Ensure production compilation completes and exits successfully
RUN pnpm turbo run build --filter=order-service...

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app

# Core runtime environment configurations
ENV NODE_ENV=${NODE_ENV:-production}
ENV PORT=${PORT:-8001}
ENV MONGO_URI=${MONGO_URI:-mongodb://root:example@mongo:27017/order_db?authSource=admin}

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd fastifyjs || adduser -u 1001 -S -G nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs fastifyjs 2>/dev/null || adduser --system --uid 1001 -G nodejs fastifyjs)
USER fastifyjs

# Copy runtime dependencies and compiled source distribution
COPY --from=installer --chown=fastifyjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=fastifyjs:nodejs /app/packages ./packages
COPY --from=installer --chown=fastifyjs:nodejs /app/apps/order-service ./apps/order-service

WORKDIR /app/apps/order-service

EXPOSE 8001

# Production optimization: Run pure compiled javascript with node
CMD ["node", "dist/index.js"]
