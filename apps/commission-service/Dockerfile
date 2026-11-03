FROM node:22-alpine AS base
RUN npm install -g pnpm@9.15.4

FROM base AS builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages ./packages
COPY apps/commission-service ./apps/commission-service

RUN pnpm install --frozen-lockfile
RUN pnpm --filter commission-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8022

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/commission-service/dist ./apps/commission-service/dist
COPY --from=builder /app/apps/commission-service/package.json ./apps/commission-service/package.json
COPY --from=builder /app/apps/commission-service/node_modules ./apps/commission-service/node_modules

EXPOSE 8022
CMD ["node", "apps/commission-service/dist/index.js"]
