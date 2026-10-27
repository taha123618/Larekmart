# ==============================================================================
# Larekmart - Admin Portal (Next.js 15) Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine
ARG BUILD_BASE_IMAGE=larekmart-base-node:latest
# For enterprise DHI environments: docker build --build-arg BASE_IMAGE=dhi.io/node:20 .

# Stage 1: Base build environment pre-configured with pnpm and turbo
FROM ${BUILD_BASE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune admin --docker

# Stage 3: Install dependencies and compile Next.js
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .

ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_API_GATEWAY_URL


ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_API_GATEWAY_URL=${NEXT_PUBLIC_API_GATEWAY_URL:-http://localhost:8090}


RUN pnpm --filter admin build

# Stage 4: Minimal hardened production runner (clean runtime, no corepack/pnpm)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd nextjs || adduser -u 1001 -S -G nodejs nextjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs nextjs 2>/dev/null || adduser --system --uid 1001 -G nodejs nextjs)
USER nextjs

COPY --from=installer --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nextjs:nodejs /app/packages ./packages
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin ./apps/admin

WORKDIR /app/apps/admin

EXPOSE 3003
ENV PORT=3003
CMD ["./node_modules/.bin/next", "start", "-p", "3003"]
