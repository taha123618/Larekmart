# ==============================================================================
# Larekmart - Seller Dashboard (Nuxt 3) Dockerfile
# Hardened multi-stage build adhering to Docker Hardened Images (DHI) standards.
# ==============================================================================

ARG BASE_IMAGE=node:20-alpine
ARG BUILD_BASE_IMAGE=larekmart-base-node:latest

# Stage 1: Base build environment pre-configured with pnpm and turbo
FROM ${BUILD_BASE_IMAGE} AS base
ENV NUXT_TELEMETRY_DISABLED=1

# Stage 2: Turbo pruning to isolate workspace
FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune seller --docker

# Stage 3: Install dependencies and compile Nuxt 3
FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/out/full/ .

ARG NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NUXT_PUBLIC_API_GATEWAY_URL
ARG NUXT_PUBLIC_WS_URL

ENV NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NUXT_PUBLIC_API_GATEWAY_URL=${NUXT_PUBLIC_API_GATEWAY_URL}
ENV NUXT_PUBLIC_WS_URL=${NUXT_PUBLIC_WS_URL}

RUN pnpm --filter seller build

# Stage 4: Minimal hardened production runner (clean runtime, unprivileged user)
FROM ${BASE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NUXT_TELEMETRY_DISABLED=1
ENV PORT=3004
ENV HOST=0.0.0.0

# Security: Run as unprivileged system user
RUN (getent group nodejs || addgroup -g 1001 -S nodejs 2>/dev/null || addgroup --system --gid 1001 nodejs) && \
    (getent passwd nuxtjs || adduser -u 1001 -S -G nodejs nuxtjs 2>/dev/null || adduser --system --uid 1001 --ingroup nodejs nuxtjs 2>/dev/null || adduser --system --uid 1001 -G nodejs nuxtjs)
USER nuxtjs

COPY --from=installer --chown=nuxtjs:nodejs /app/node_modules ./node_modules
COPY --from=installer --chown=nuxtjs:nodejs /app/packages ./packages
COPY --from=installer --chown=nuxtjs:nodejs /app/apps/seller/.output ./apps/seller/.output

WORKDIR /app/apps/seller

EXPOSE 3004
CMD ["node", ".output/server/index.mjs"]
