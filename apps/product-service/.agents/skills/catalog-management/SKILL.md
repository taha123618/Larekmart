---
name: catalog-management
description: Use when modifying the product catalog in apps/product-service, including Prisma queries, Express controllers, Kafka event publishing, or Clerk route guards.
---

# Catalog Management Workflows

Guidance for developing in `apps/product-service` (Express 5, port 8000).

## 1. Route Controllers & Handlers

- Organize routes in `src/routes/` and controllers in `src/controllers/`.
- Routes:
  - `GET /products`: Filter products by category slug, search query, price ranges.
  - `GET /products/:id`: Retrieve single product with full category and variant images.
  - `POST /products`: Create product; emit `product.created` Kafka event.
  - `PUT /products/:id`: Update product attributes (guarded by `shouldBeAdmin`).
  - `DELETE /products/:id`: Delete product; emit `product.deleted` Kafka event (guarded by `shouldBeAdmin`).
  - `GET /categories`, `POST /categories`, `PUT /categories/:id`, `DELETE /categories/:id`.

## 2. Persistence via `@repo/product-db`

- Access PostgreSQL exclusively through the shared `prisma` client from `@repo/product-db`.
- Never create raw SQL queries or ad-hoc Prisma instances.

## 3. Event Publishing (`@repo/kafka`)

- Publish `product.created`:
  ```ts
  await producer.send("product.created", {
    value: {
      id: product.id.toString(),
      name: product.name,
      price: product.price,
    },
  });
  ```
- Publish `product.deleted`:
  ```ts
  await producer.send("product.deleted", {
    value: product.id,
  });
  ```

## 4. Verification

```bash
pnpm --filter product-service check-types
```
