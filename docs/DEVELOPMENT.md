# Development guide

Everything needed to run Larekmart locally, the environment matrix, the daily
workflow, and deployment notes.

## Prerequisites

| Tool                     | Version    | Notes                                                       |
| ------------------------ | ---------- | ----------------------------------------------------------- |
| Node.js                  | ≥ 18       | root `engines`                                              |
| pnpm                     | 9.0.0      | `corepack enable && corepack prepare pnpm@9.0.0 --activate` |
| Docker                   | any recent | local Kafka cluster                                         |
| PostgreSQL               | ≥ 14       | product catalog                                             |
| MongoDB                  | ≥ 6        | orders                                                      |
| Clerk account            | —          | auth keys for three apps/services                           |
| Stripe test account      | —          | payment-service + client                                    |
| Google OAuth credentials | —          | email-service Gmail sending                                 |
| Cloudinary account       | —          | admin image uploads                                         |

## First-time setup

```bash
# Automated monorepo setup (installs workspaces, initializes .env, syncs AI skills)
pnpm run setup

# Or step-by-step:
pnpm run install:all                      # install all workspace packages
pnpm run env:setup                        # safely copy all .env.example -> .env
pnpm run skills:sync                      # sync .agents/skills to .cursor, .claude, .gemini

# infrastructure
docker compose -f packages/kafka/docker-compose.yml up -d   # Kafka cluster
docker compose -f packages/redis/docker-compose.yml up -d   # Redis (service caches + rate limiting)

# database
pnpm --filter @repo/product-db db:generate
pnpm --filter @repo/product-db db:migrate

# run everything
pnpm dev
```

## Environment matrix

| Workspace       | Variable                                                           | Required    | Purpose                              |
| --------------- | ------------------------------------------------------------------ | ----------- | ------------------------------------ |
| admin           | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                | yes         | Clerk frontend                       |
| admin           | `CLERK_SECRET_KEY`                                                 | yes         | Clerk server                         |
| admin           | `NEXT_PUBLIC_AUTH_SERVICE_URL`                                     | yes         | e.g. `http://localhost:8003`         |
| admin           | `NEXT_PUBLIC_ORDER_SERVICE_URL`                                    | yes         | e.g. `http://localhost:8001`         |
| admin           | `NEXT_PUBLIC_PRODUCT_SERVICE_URL`                                  | yes         | e.g. `http://localhost:8000`         |
| admin           | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`                                | yes         | image uploads                        |
| client          | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`           | yes         | Clerk                                |
| client          | `NEXT_PUBLIC_ORDER_SERVICE_URL`                                    | yes         | orders                               |
| client          | `NEXT_PUBLIC_PRODUCT_SERVICE_URL`                                  | yes         | catalog                              |
| client          | `NEXT_PUBLIC_PAYMENT_SERVICE_URL`                                  | yes         | checkout                             |
| client          | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                               | recommended | currently a literal test key in code |
| product-service | `NODE_ENV`, `DATABASE_URL`, `CLERK_SECRET_KEY`                     | yes         | Prisma + auth                        |
| order-service   | `MONGO_URL`, `CLERK_SECRET_KEY`                                    | yes         | Mongoose + auth                      |
| payment-service | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                       | yes         | Stripe + webhook verification        |
| auth-service    | `CLERK_SECRET_KEY`                                                 | yes         | Clerk backend                        |
| email-service   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | yes         | Gmail OAuth2                         |

Default local connection strings used by the examples:

- PostgreSQL: `postgresql://postgres:postgres@localhost:5432/ecommerce`
- MongoDB: `mongodb://localhost:27017/ecommerce`
- Kafka: `localhost:9094,localhost:9095,localhost:9096` (hardcoded in `@repo/kafka`)

## Ports

| Service                   | Port               |
| ------------------------- | ------------------ |
| client (storefront)       | 3002               |
| admin (dashboard)         | 3003               |
| product-service           | 8000               |
| order-service             | 8001               |
| payment-service           | 8002               |
| auth-service              | 8003               |
| analytic-service          | 8004               |
| notification-service (Go) | 8005               |
| Kafka UI                  | 8080               |
| Kafka brokers             | 9094 / 9095 / 9096 |
| ZooKeeper                 | 2181               |
| PostgreSQL                | 5432               |
| MongoDB                   | 27017              |

## Daily workflow

```bash
pnpm dev                                      # all workspaces (Next.js, Node, and Go)
pnpm --filter admin dev                       # one app
pnpm --filter product-service dev             # one Node service (tsx --watch)
pnpm --filter notification-service dev        # Go notification service (go run)

# Or run notification-service via Docker Compose
docker compose -f apps/notification-service/docker-compose.yml up -d

pnpm check-types                              # before every commit
pnpm lint                                     # admin + client
pnpm format                                   # prettier, writes source
```

### Database changes (product-db)

```bash
# 1. edit packages/product-db/prisma/schema.prisma
pnpm --filter @repo/product-db db:generate    # regenerate client (required for types)
pnpm --filter @repo/product-db db:migrate     # create + apply a migration
# production
pnpm --filter @repo/product-db db:deploy
```

`packages/product-db/generated/prisma` is gitignored; regenerate rather than commit it.

### Kafka development

- Start the cluster, then watch topics and consumer groups in Kafka UI (`:8080`).
- Consumers start from the beginning of topics, so restarts re-deliver history.
- To add a topic, update producer + consumers + `@repo/types` +
  `docs/EVENT-DRIVEN-ARCHITECTURE.md`.

## Build & run in production mode

```bash
pnpm build                                        # turbo, dependency-ordered

pnpm --filter admin start                         # next start
pnpm --filter client start
pnpm --filter payment-service start                # node dist/index.js

# services without a build step run their TypeScript directly
pnpm --filter product-service dev                  # or a process manager with tsx
pnpm --filter order-service dev
pnpm --filter auth-service dev
pnpm --filter email-service dev
```

## Deployment notes

There is **no CI/CD pipeline and no Dockerfiles** in the repository. Each workspace is
deployed independently:

- **Next.js apps** (`admin`, `client`): build with `pnpm build` and host on a Next.js
  platform (e.g. Vercel). Provision all `NEXT_PUBLIC_*` and Clerk variables per
  environment.
- **Node services**: run as long-lived processes. `payment-service` builds with `tsc` and
  runs `node dist/index.js`; the others run from source via `tsx` under a process
  manager. Provide each service its own env file/secrets.
- **email-service**: a worker process with no inbound port; deploy alongside the other
  services and give it Kafka access.
- **Infrastructure**: use managed PostgreSQL, MongoDB, and Kafka in production. Note that
  `@repo/kafka` currently hardcodes local broker addresses — production deployments need
  a configurable broker list before they will work against managed Kafka.

### Production checklist

- [ ] Every secret from the env matrix provisioned (no `.env` committed).
- [ ] `DATABASE_URL` migrations applied via `db:deploy`.
- [ ] Kafka brokers reachable and configurable (see caveat above).
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set.
- [ ] Clerk allowed origins/domains updated for the deployed frontends.
- [ ] Service CORS allow-lists updated from `localhost` to real origins.
