# @repo/catalog-db

Prisma client and PostgreSQL read-model schema for the **`catalog-service`** product discovery, collections, and merchandising layer.

## Schema Overview

- `CatalogProduct`: Denormalized read model for storefront product cards and listings.
- `CatalogCategory`: Hierarchical category tree with parent-child relations and positioning.
- `CatalogBrand`: Brand entities and associated product listings.
- `CatalogCollection`: Curated collections (e.g. New Arrivals, Best Sellers, Flash Sale).
- `CatalogCollectionProduct`: Manual merchandising order of products in collections.
- `CatalogCategoryProduct`: Manual merchandising order of products in categories.
- `CatalogProductVariant`: Variant snapshot for product discovery.
- `ProcessedEvent`: Idempotency tracking table for Kafka domain events.
