# wishlist-service

High-performance wishlists, saved products, guest-to-user merging, and price drop & restock notifications microservice for the Larekmart platform.

## Architecture

- **Runtime**: Node.js 22 LTS
- **Framework**: Fastify 5
- **Database**: PostgreSQL (`wishlist_db`) managed with Drizzle ORM
- **Cache**: Redis (`@repo/redis`) with prefix `wishlist:v1:`
- **Event Bus**: Apache Kafka (`@repo/kafka`)
- **Authentication**: Clerk JWT & Api-Gateway Internal Secret Delegation (`@repo/types`)
- **Default Port**: `8015`

## Features

1. **Default & Multiple Named Wishlists**:
   - Automatically initializes a default "My Wishlist" for authenticated customers on first access.
   - Supports creating, renaming, and organizing multiple custom wishlists (e.g., "Favorites", "Gift Ideas", "Office Setup").
2. **Duplicate Prevention**:
   - Unique constraint and database-level unique indexing on `(wishlist_id, product_id, COALESCE(variant_id, ''))` prevents duplicate items within any wishlist.
3. **Move Items Between Wishlists**:
   - Customers can seamlessly transfer items between their wishlists.
4. **Guest-to-User Wishlist Merge**:
   - Supports guest browsing and saving items prior to sign-in.
   - On customer login, merges guest selections into their default wishlist with predictable conflict resolution.
5. **Shared Wishlists & Unguessable Tokens**:
   - Generate secure, unguessable share tokens (`wsh_...`) with optional expiration dates and access permissions (`VIEW`, `EDIT`).
   - Private wishlists remain secure; possession of an unguessable share token grants read access without exposing private wishlist IDs.
6. **Price Drop & Restock Alerts (Kafka Event-Driven)**:
   - Does not store authoritative product catalogs or inventory.
   - Consumes `price.updated`, `product.updated`, `inventory.availability.changed`, `inventory.adjusted`, and `user.deleted`.
   - Computes price drops against saved prices and broadcasts `wishlist.price-drop` and `wishlist.restocked` events for `notification-service`.
7. **Bulk Operations & Pagination**:
   - High-throughput batch removal of items (`DELETE /api/v1/me/wishlists/:wishlistId/items`).
   - Standard cursor/offset pagination on items and lists.

## API Endpoints

```
GET    /api/v1/me/wishlists
POST   /api/v1/me/wishlists
POST   /api/v1/me/wishlists/merge
GET    /api/v1/me/wishlists/:wishlistId
PATCH  /api/v1/me/wishlists/:wishlistId
DELETE /api/v1/me/wishlists/:wishlistId

POST   /api/v1/me/wishlists/:wishlistId/items
DELETE /api/v1/me/wishlists/:wishlistId/items/:itemId
DELETE /api/v1/me/wishlists/:wishlistId/items (bulk removal)

POST   /api/v1/me/wishlists/:wishlistId/items/move
POST   /api/v1/me/wishlists/:wishlistId/share

GET    /api/v1/shared-wishlists/:shareToken

GET    /health
GET    /ready
GET    /metrics
```

## Kafka Events

### Consumed

- `product.updated`
- `product.deleted`
- `price.updated`
- `inventory.availability.changed`
- `inventory.adjusted`
- `user.deleted`

### Published

- `wishlist.created`
- `wishlist.item.added`
- `wishlist.item.removed`
- `wishlist.item.moved`
- `wishlist.merged`
- `wishlist.price-drop`
- `wishlist.restocked`

## Commands

```bash
# Development
pnpm --filter wishlist-service dev

# Type check
pnpm --filter wishlist-service check-types

# Run tests
pnpm --filter wishlist-service test

# Database migrations
pnpm --filter wishlist-service db:migrate
```
