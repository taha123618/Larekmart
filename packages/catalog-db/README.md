# @repo/catalog-db

Prisma client and PostgreSQL read-model schema for the **`catalog-service`** product discovery, collections, and merchandising layer.

---

## Dual Client Architecture (Read-Replicas & PgBouncer)

To endure high-velocity shopping festivals without exhausting primary database connection pools, `@repo/catalog-db` provides dual Prisma client singletons:

- **`prisma`**: Primary read-write client connected via `DATABASE_URL`. Used by Kafka event projectors (`product-projector`, `category-projector`, `collection-projector`) to persist materialized read models.
- **`readPrisma`**: Dedicated read-replica client connected via `DATABASE_READ_REPLICA_URL` (or PgBouncer transaction pool on port 6432). Used by storefront discovery repositories (`catalog.repository`, `category.repository`, `brand.repository`, `collection.repository`) to serve customer browsing traffic without database write contention. Transparently falls back to `prisma` if `DATABASE_READ_REPLICA_URL` is omitted.
- **`disconnectPrisma()`**: Utility ensuring clean shutdown of both client connection pools during process termination.

---

## Schema Overview

- `CatalogProduct`: Denormalized read model for storefront product cards and listings.
- `CatalogCategory`: Hierarchical category tree with parent-child relations and positioning.
- `CatalogBrand`: Brand entities and associated product listings.
- `CatalogCollection`: Curated collections (e.g. New Arrivals, Best Sellers, Flash Sale).
- `CatalogCollectionProduct`: Manual merchandising order of products in collections.
- `CatalogCategoryProduct`: Manual merchandising order of products in categories.
- `CatalogProductVariant`: Variant snapshot for product discovery.
- `ProcessedEvent`: Idempotency tracking table for Kafka domain events.

---

## Development Commands

```bash
# Generate Prisma Client
pnpm --filter @repo/catalog-db db:generate

# Run Migrations
pnpm --filter @repo/catalog-db db:migrate

# Type Check
pnpm --filter @repo/catalog-db check-types
```
