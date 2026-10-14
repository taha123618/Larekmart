# Development guide

Everything needed to run Larekmart locally, the environment matrix, the daily
workflow, and deployment notes.

## Prerequisites

| Tool                     | Version    | Notes                                                                           |
| ------------------------ | ---------- | ------------------------------------------------------------------------------- |
| Node.js                  | ≥ 18       | root `engines`                                                                  |
| pnpm                     | 9.0.0      | `corepack enable && corepack prepare pnpm@9.0.0 --activate`                     |
| Docker                   | any recent | local Kafka, Redis, and optional OpenSearch                                     |
| PostgreSQL               | ≥ 14       | product, inventory, catalog, analytics, notification, and recommendation stores |
| pgvector                 | —          | `CREATE EXTENSION vector` for recommendation-service embeddings                 |
| MongoDB                  | ≥ 6        | orders and carts                                                                |
| Clerk account            | —          | auth keys for three apps/services                                               |
| Stripe test account      | —          | payment-service + client                                                        |
| Google OAuth credentials | —          | email-service Gmail sending                                                     |
| Cloudinary account       | —          | admin image uploads                                                             |
| OpenSearch               | 2.x+       | product search index (`search-service` owns writes)                             |

## First-time setup

```bash
# ------------------------------------------------------------------------------
# Option A: Full Containerized Ecosystem (Single Command)
# ------------------------------------------------------------------------------
docker compose up -d --build
# Starts all databases, Redis, Kafka, OpenSearch, Kafka UI, 13 microservices, and 2 Next.js apps.
# See docs/DOCKER.md for full operations guide.

# ------------------------------------------------------------------------------
# Option B: Local Development with Containerized Backing Infrastructure
# ------------------------------------------------------------------------------
# 1. Automated monorepo setup (installs workspaces, initializes .env, syncs AI skills)
pnpm run setup

# 2. Start backing infrastructure in Docker (PostgreSQL with pgvector, MongoDB, Mongo-Express, Redis, Kafka KRaft, OpenSearch, Kafka UI)
docker compose up -d postgres mongo mongo-express redis kafka opensearch kafka-ui

# 3. Apply database migrations
pnpm --filter @repo/product-db db:deploy
pnpm --filter @repo/inventory-db db:deploy
pnpm --filter @repo/catalog-db db:deploy
pnpm --filter @repo/shipping-db db:deploy

# 4. Run all services concurrently in development mode
pnpm dev
```

## Environment matrix

| Workspace              | Variable                                                                                                                                                                                                                                              | Required    | Purpose                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| admin                  | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                                                                                                                                                                                                   | yes         | Clerk frontend                                                                                                                   |
| admin                  | `CLERK_SECRET_KEY`                                                                                                                                                                                                                                    | yes         | Clerk server                                                                                                                     |
| admin                  | `NEXT_PUBLIC_AUTH_SERVICE_URL`                                                                                                                                                                                                                        | yes         | e.g. `http://localhost:8003`                                                                                                     |
| admin                  | `NEXT_PUBLIC_ORDER_SERVICE_URL`                                                                                                                                                                                                                       | yes         | e.g. `http://localhost:8001`                                                                                                     |
| admin                  | `NEXT_PUBLIC_PRODUCT_SERVICE_URL`                                                                                                                                                                                                                     | yes         | e.g. `http://localhost:8000`                                                                                                     |
| admin                  | `NEXT_PUBLIC_ANALYTIC_SERVICE_URL`, `NEXT_PUBLIC_SEARCH_SERVICE_URL`                                                                                                                                                                                  | yes         | analytics and search index actions                                                                                               |
| admin                  | `NEXT_PUBLIC_NOTIFICATION_SERVICE_URL`, `NEXT_PUBLIC_NOTIFICATION_WS_URL`                                                                                                                                                                             | optional    | notification API and WebSocket                                                                                                   |
| admin                  | `NEXT_PUBLIC_INVENTORY_SERVICE_URL`, `NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL`, `NEXT_PUBLIC_CART_SERVICE_URL`, `NEXT_PUBLIC_CATALOG_SERVICE_URL`, `NEXT_PUBLIC_SHIPPING_SERVICE_URL`, `NEXT_PUBLIC_USER_SERVICE_URL`, `NEXT_PUBLIC_MEDIA_SERVICE_URL` | optional    | remaining backend dashboards (all default to localhost ports)                                                                    |
| admin                  | `ALLOW_ADMIN_CLAIM`, `ADMIN_REGISTRATION_SECRET`                                                                                                                                                                                                      | varies      | admin self-promotion bootstrap; disabled unless both flags are set; secret is always prompted, never sent from a public env var  |
| client                 | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`                                                                                                                                                                                              | yes         | Clerk                                                                                                                            |
| client                 | `NEXT_PUBLIC_ORDER_SERVICE_URL`                                                                                                                                                                                                                       | yes         | orders                                                                                                                           |
| client                 | `NEXT_PUBLIC_PRODUCT_SERVICE_URL`                                                                                                                                                                                                                     | yes         | catalog                                                                                                                          |
| client                 | `NEXT_PUBLIC_PAYMENT_SERVICE_URL`                                                                                                                                                                                                                     | yes         | checkout                                                                                                                         |
| client                 | `NEXT_PUBLIC_SEARCH_SERVICE_URL`, `NEXT_PUBLIC_NOTIFICATION_SERVICE_URL`, `NEXT_PUBLIC_NOTIFICATION_WS_URL`                                                                                                                                           | optional    | autocomplete and live notifications                                                                                              |
| client                 | `NEXT_PUBLIC_INVENTORY_SERVICE_URL`, `NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL`, `NEXT_PUBLIC_CART_SERVICE_URL`, `NEXT_PUBLIC_CATALOG_SERVICE_URL`, `NEXT_PUBLIC_SHIPPING_SERVICE_URL`, `NEXT_PUBLIC_USER_SERVICE_URL`, `NEXT_PUBLIC_MEDIA_SERVICE_URL` | optional    | remaining storefront integrations (all default to localhost ports)                                                               |
| client                 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`                                                                                                                                                                                                                  | recommended | currently a literal test key in code                                                                                             |
| product-service        | `NODE_ENV`, `DATABASE_URL`, `CLERK_SECRET_KEY`                                                                                                                                                                                                        | yes         | Prisma + auth                                                                                                                    |
| product-service        | `OPENSEARCH_NODE`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`, `OPENSEARCH_ALIAS`, `OPENSEARCH_REQUEST_TIMEOUT`                                                                                                                                     | yes         | shared search reads                                                                                                              |
| product-service        | `REDIS_URL`, `REDIS_KEY_PREFIX`, `PRODUCT_CACHE_TTL_SECONDS`, `CATEGORY_CACHE_TTL_SECONDS`                                                                                                                                                            | optional    | catalog cache                                                                                                                    |
| order-service          | `MONGO_URL`, `CLERK_SECRET_KEY`                                                                                                                                                                                                                       | yes         | Mongoose + auth                                                                                                                  |
| order-service          | `MONGO_SYNC_INDEXES`                                                                                                                                                                                                                                  | optional    | unset = sync everywhere except production; `true`/`false` override                                                               |
| order-service          | `REDIS_URL`, `REDIS_KEY_PREFIX`, `ORDER_CHART_CACHE_TTL_SECONDS`                                                                                                                                                                                      | optional    | order chart cache                                                                                                                |
| payment-service        | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                                                                                                                                                                                          | yes         | Stripe + webhook verification                                                                                                    |
| auth-service           | `CLERK_SECRET_KEY`                                                                                                                                                                                                                                    | yes         | Clerk backend                                                                                                                    |
| analytic-service       | `PORT`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`                                                                                                                                                                                   | yes         | analytics HTTP API and worker                                                                                                    |
| analytic-service       | `REDIS_URL`, `REDIS_KEY_PREFIX`, `ANALYTICS_CHART_CACHE_TTL_SECONDS`, `ANALYTICS_EVENTS_CACHE_TTL_SECONDS`                                                                                                                                            | optional    | dashboard cache                                                                                                                  |
| email-service          | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`                                                                                                                                                                                    | yes         | Gmail OAuth2                                                                                                                     |
| email-service          | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `KAFKA_BROKERS`                                                                                                                                                          | optional    | direct SMTP fallback when Gmail OAuth2 is not configured                                                                         |
| notification-service   | `HTTP_PORT`, `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, `KAFKA_CONSUMER_TOPICS`                                                                                                                                                  | yes         | Go HTTP API, persistence, and consumers                                                                                          |
| notification-service   | provider, WebSocket, worker, OpenTelemetry, and logging variables in `.env.example`                                                                                                                                                                   | varies      | channel delivery and observability                                                                                               |
| search-service         | `PORT`, `HOST`, `OPENSEARCH_NODE`, `OPENSEARCH_INDEX`, `OPENSEARCH_ALIAS`, `REDIS_URL`, `REDIS_KEY_PREFIX`                                                                                                                                            | yes         | search API and index                                                                                                             |
| search-service         | `SEARCH_CACHE_TTL_SECONDS`, `SUGGESTION_CACHE_TTL_SECONDS`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, Clerk and OpenTelemetry variables                                                                                                                      | varies      | cache, events, auth, and tracing                                                                                                 |
| inventory-service      | `PORT`, `DATABASE_URL`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `INVENTORY_CACHE_TTL_SECONDS`, `KAFKA_GROUP_ID`, Clerk and OpenTelemetry variables                                                                                                           | varies      | inventory API, cache, events, auth, and tracing                                                                                  |
| media-service          | `DATABASE_URL`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `CLERK_SECRET_KEY`                                                           | yes         | media API, workers, object storage, and events                                                                                   |
| media-service          | `MEDIA_WORKER_POLL_INTERVAL_MS`, `MEDIA_WORKER_MAX_ATTEMPTS`, `MEDIA_WORKER_STALE_JOB_SECONDS`, `MEDIA_CLEANUP_INTERVAL_MS`, `MEDIA_UPLOAD_SESSION_TTL_SECONDS`                                                                                       | optional    | worker polling, retry budget, stale-job requeue (crashed worker recovery, default 900s), cleanup cadence, and upload-session TTL |
| cart-service           | `MONGO_URL`, `CLERK_SECRET_KEY`                                                                                                                                                                                                                       | yes         | authoritative MongoDB carts + auth                                                                                               |
| cart-service           | `MONGO_SYNC_INDEXES`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`, `PRODUCT_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `GUEST_CART_TTL_SECONDS`, `USER_CART_TTL_SECONDS`, `CART_CACHE_TTL_SECONDS`                                 | optional    | cache, events, pricing validation, and cart TTLs                                                                                 |
| catalog-service        | `PORT`, `DATABASE_URL`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`                                                                                                                                                            | yes         | read-optimized product discovery API                                                                                             |
| catalog-service        | `CATALOG_CACHE_TTL_SECONDS`                                                                                                                                                                                                                           | optional    | catalog read-model cache                                                                                                         |
| shipping-service       | `PORT`, `DATABASE_URL`, `REDIS_URL`, `REDIS_KEY_PREFIX`, `KAFKA_BROKERS`, `KAFKA_GROUP_ID`                                                                                                                                                            | yes         | shipment lifecycle, rates, carrier adapters, tracking                                                                            |
| shipping-service       | `WEBHOOK_SECRET`                                                                                                                                                                                                                                      | yes         | webhook signature verification; empty placeholder rejects all signed requests                                                    |
| shipping-service       | `SHIPPING_RATE_CACHE_TTL_SECONDS`, `TRACKING_CACHE_TTL_SECONDS`, `DEFAULT_CARRIER`                                                                                                                                                                    | optional    | rates/tracking cache and fallback carrier                                                                                        |
| user-service           | `PORT`, `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`                                                                                                                                                                                   | yes         | customer profiles, addresses, preferences                                                                                        |
| user-service           | `INTERNAL_SERVICE_SECRET`, `ALLOWED_ORIGINS`, `REDIS_URL`, `KAFKA_BROKERS`                                                                                                                                                                            | optional    | internal auth, CORS, cache, and events                                                                                           |
| recommendation-service | `DATABASE_URL` (pgvector), `REDIS_URL`, `KAFKA_BOOTSTRAP_SERVERS`                                                                                                                                                                                     | yes         | recommendation API, cache, and event stream                                                                                      |
| recommendation-service | `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `RECOMMENDATION_CACHE_TTL`, `DEFAULT_RECOMMENDATION_LIMIT`, `CORS_ORIGINS`                                                                                                                              | optional    | Celery worker broker/results and tuning                                                                                          |

Default local connection strings used by the examples (match the databases the
Postgres container provisions via `POSTGRES_MULTIPLE_DATABASES`):

- PostgreSQL: one database per owning service on `localhost:5432` — `product_db`,
  `inventory_db` (`larekmart_inventory_db` in inventory-service's example), `catalog_db`,
  `shipping_db` (`larekmart_shipping_db` in shipping-service's example), `analytics_db`,
  `larekmart_notification_db`, `recommendation_db`, `user_db`, and `media_db`. Each
  service's `DATABASE_URL` lives in its own `apps/<service>/.env`.
- MongoDB: `mongodb://root:example@localhost:27017/order_db?authSource=admin` (order-service) and
  `mongodb://root:example@localhost:27017/ecommerce?authSource=admin` (cart-service)
- Kafka: `localhost:9094,localhost:9095,localhost:9096` (hardcoded in `@repo/kafka`)
- OpenSearch: `http://localhost:9200` (used by product-service reads and search-service writes)

## Ports

| Service                          | Port               |
| -------------------------------- | ------------------ |
| client (storefront)              | 3002               |
| admin (dashboard)                | 3003               |
| product-service                  | 8000               |
| order-service                    | 8001               |
| payment-service                  | 8002               |
| auth-service                     | 8003               |
| analytic-service                 | 8004               |
| notification-service (Go)        | 8005               |
| search-service                   | 8006               |
| inventory-service                | 8007               |
| recommendation-service (FastAPI) | 8008               |
| cart-service                     | 8009               |
| catalog-service                  | 8010               |
| shipping-service                 | 8011               |
| user-service                     | 8012               |
| media-service (Hono)             | 8013               |
| review-service (Fastify)         | 8014               |
| Kafka UI                         | 8080               |
| Mongo Express                    | 8081               |
| Kafka brokers                    | 9094 / 9095 / 9096 |
| PostgreSQL                       | 5432               |
| MongoDB                          | 27017              |
| Redis                            | 6379               |
| OpenSearch                       | 9200               |

## Daily workflow

```bash
pnpm dev                                      # all workspaces (Next.js, Node, and Go)
pnpm --filter admin dev                       # one app
pnpm --filter product-service dev             # one Node service (tsx --watch)
pnpm --filter notification-service dev        # Go notification service (go run)
pnpm --filter search-service dev              # Fastify search API and Kafka index consumer
pnpm --filter inventory-service dev           # Hono inventory API and Kafka event producer

pnpm --filter notification-service test       # Go unit tests
pnpm --filter @repo/redis verify:redis        # Redis integration check; requires Redis

pnpm check-types                              # before every commit
pnpm lint                                     # admin + client
pnpm format                                   # prettier, writes source
```

### Database migrations

Each service owns its own store and there is no shared database, so only migrate the
workspaces you touched. The tool differs per store:

| Store                         | Owner                  | Tooling                         | How to migrate                                                              |
| ----------------------------- | ---------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| `larekmart_product_db`        | product-service        | Prisma (`@repo/product-db`)     | `pnpm --filter @repo/product-db db:deploy` (or `db:migrate` in development) |
| `larekmart_inventory_db`      | inventory-service      | Prisma (`@repo/inventory-db`)   | `pnpm --filter @repo/inventory-db db:deploy`                                |
| `larekmart_catalog_db`        | catalog-service        | Prisma (`@repo/catalog-db`)     | `pnpm --filter @repo/catalog-db db:deploy`                                  |
| `larekmart_recommendation_db` | recommendation-service | Alembic + SQLAlchemy (pgvector) | `cd apps/recommendation-service && uv run alembic upgrade head`             |
| `larekmart_notification_db`   | notification-service   | Embedded SQL in `migrations/`   | automatic on startup (`internal/db`); verify with the opt-in test below     |
| `larekmart_analytics_db`      | analytic-service       | Inline DDL in `src/db.ts`       | automatic on startup                                                        |
| `larekmart_order_db`          | order-service          | Mongoose (no migrations)        | collections/indexes sync on connect                                         |
| `larekmart_cart_db`           | cart-service           | Mongoose (no migrations)        | collections/indexes sync on connect                                         |

#### Prisma packages (`product-db`, `inventory-db`, `catalog-db`)

The Prisma CLI only loads `.env` from the directory it runs in, and `packages/*-db` ship
no `.env` of their own. A bare `pnpm --filter @repo/product-db db:deploy` therefore fails
with `Environment variable not found: DATABASE_URL`. Source the owning service's env
first — `set -a` exports every variable in the file so the child process inherits it, and
`set +a` restores the default behaviour:

```bash
# product-db <- apps/product-service/.env
set -a; . apps/product-service/.env; set +a
pnpm --filter @repo/product-db db:generate    # regenerate client (required for types)
pnpm --filter @repo/product-db db:migrate     # development: create + apply a migration
pnpm --filter @repo/product-db db:deploy      # apply committed migrations only

# inventory-db <- apps/inventory-service/.env
set -a; . apps/inventory-service/.env; set +a
pnpm --filter @repo/inventory-db db:generate
pnpm --filter @repo/inventory-db db:migrate

# catalog-db <- apps/catalog-service/.env
set -a; . apps/catalog-service/.env; set +a
pnpm --filter @repo/catalog-db db:generate
pnpm --filter @repo/catalog-db db:migrate
```

Passing the variable inline works too:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/larekmart_product_db" \
  pnpm --filter @repo/product-db db:deploy
```

Use `db:migrate` only while developing: it diffs the schema, creates a migration file, and
can offer to reset the database when it detects drift. Use `db:deploy`, which applies the
committed migrations and never resets, for existing environments and production.

`packages/*-db/generated/prisma` is gitignored; regenerate rather than commit it.

If the generated client is missing, `pnpm check-types` fails for every dependent
workspace — run `db:generate` for the package you changed before type-checking.

#### recommendation-service (Alembic)

`migrations/env.py` reads the URL from the service settings, so `DATABASE_URL` must be set
in `apps/recommendation-service/.env` (the `sqlalchemy.url` value in `alembic.ini` is only
a fallback).

```bash
cd apps/recommendation-service
uv run alembic current            # show the applied revision
uv run alembic upgrade head       # apply pending migrations
uv run alembic revision --autogenerate -m "add x"   # create a migration from model changes
```

The initial revision runs `CREATE EXTENSION IF NOT EXISTS vector`, so PostgreSQL needs the
`pgvector` extension available.

#### notification-service (embedded SQL)

Migrations are embedded in the binary and applied on every startup, so there is no command
to run. Each applied script is recorded in `schema_migrations` with a SHA-256 checksum; never
edit an applied migration — add the next `<version>_<name>.up.sql` instead. Inspect and
verify with:

```bash
psql "$DATABASE_URL" -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"

cd apps/notification-service
NOTIFICATION_DB_TEST_URL="$DATABASE_URL" go test ./internal/db/ -run Integration -v
```

#### MongoDB stores (`order-db`, `cart-db`)

Mongoose has no migration concept: collections and indexes are derived from the schemas.
Both connection helpers reconcile the database with the models on connect — creating the
declared indexes and **dropping any index no schema declares** (`_id` is always kept) — so
a restart is enough to apply an index change:

| `MONGO_SYNC_INDEXES` | Behaviour                                          |
| -------------------- | -------------------------------------------------- |
| unset                | syncs everywhere except when `NODE_ENV=production` |
| `true`               | syncs in every environment, including production   |
| `false`              | never syncs, in any environment                    |

Dropping is destructive by design: an index added directly in MongoDB, for a query the
schemas do not describe, is removed. Production is therefore opt-in — set
`MONGO_SYNC_INDEXES=true` there only once no hand-managed indexes exist. A failed sync is
logged and never thrown, so the symptom is a missing index (performance), not a service that
refuses to start.

To reconcile without restarting the service — the only way to sync under
`NODE_ENV=production` without opting in — call the helper directly:

```bash
# order-service (has tsx as a dev dependency)
cd apps/order-service
pnpm exec tsx --env-file=.env -e '(async () => {
  const db = await import("@repo/order-db");
  await db.connectOrderDB(); await db.syncOrderIndexes(); await db.Order.db.close();
})();'

# cart-service uses pnpm dlx instead (tsx is not a local dependency)
cd apps/cart-service
pnpm dlx tsx --env-file=.env -e '(async () => {
  const db = await import("@repo/cart-db");
  await db.connectCartDB(); await db.syncCartIndexes(); await db.closeCartDB();
})();'
```

The `mongosh` equivalent for checking what exists:

```bash
mongosh --quiet --eval 'db.getSiblingDB("larekmart_order_db").getCollection("orders").getIndexes()'
```

#### Creating the databases

A fresh PostgreSQL server has none of these databases. Create them before running any
migration (adjust the role/port to your setup), then apply each store's migrations as above:

```bash
for db in larekmart_product_db larekmart_inventory_db larekmart_catalog_db \
          larekmart_analytics_db larekmart_notification_db larekmart_recommendation_db; do
  createdb "$db"
done
```

The two MongoDB databases do not need creating: MongoDB creates them on first write, and the
services create their collections on connect.

#### Checking migration state

```bash
# Prisma: one row per applied migration, with its checksum
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;"

# Alembic
cd apps/recommendation-service && uv run alembic current

# Notification
psql "$DATABASE_URL" -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"
```

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

There is **no CI/CD pipeline** in the repository. The notification service includes a
Dockerfile; the other workspaces do not currently include production Dockerfiles. Each workspace is
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
- [ ] Migrations applied for every deployed store (`db:deploy` for the Prisma packages,
      `alembic upgrade head` for recommendation-service; notification-service and
      analytic-service migrate on startup).
- [ ] Kafka brokers reachable and configurable (see caveat above).
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set.
- [ ] Clerk allowed origins/domains updated for the deployed frontends.
- [ ] Service CORS allow-lists updated from `localhost` to real origins.
