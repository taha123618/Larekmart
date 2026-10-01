# ==============================================================================
# Larekmart - Payment Service Dockerfile
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
RUN turbo prune payment-service --docker

# Stage 3: Install dependencies
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=payment-service... || true

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd honojs || adduser -u 1001 -S -G nodejs honojs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs honojs 2>/dev/null || adduser --system --uid 1001 -G nodejs honojs)
USER honojs

COPY --from=installer --chown=honojs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=honojs:nodejs /app/packages ./packages
COPY --from=installer --chown=honojs:nodejs /app/apps/payment-service ./apps/payment-service

WORKDIR /app/apps/payment-service

EXPOSE 8002
CMD ["node", "--import", "tsx", "src/index.ts"]
