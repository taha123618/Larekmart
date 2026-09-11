# Product Service (`apps/product-service`)

Microservice managing the clothing product and category catalog.

## Tech Stack

- **Framework**: Express 5
- **Database**: PostgreSQL via Prisma (`@repo/product-db`)
- **Messaging**: Apache Kafka (`@repo/kafka`)
- **Auth**: Clerk (`@clerk/express`)
- **Port**: `8000`

## Endpoints

- `GET /products`: List products with filtering by category, search, and pagination.
- `GET /products/:id`: Get product details by ID.
- `POST /products`: Create product and emit `product.created`.
- `PUT /products/:id`: Update product (admin only).
- `DELETE /products/:id`: Delete product and emit `product.deleted` (admin only).
- `GET /categories`: List categories.
- `POST /categories`: Create category (admin only).
- `PUT /categories/:id`: Update category (admin only).
- `DELETE /categories/:id`: Delete category (admin only).
- `GET /health`: Health check (`status`, `uptime`, `timestamp`).

## Event Integrations

- **Emits**:
  - `product.created`: Consumed by `payment-service` to mirror products to Stripe.
  - `product.deleted`: Consumed by `payment-service` to remove products from Stripe.

## Environment Variables

Copy `.env.example` to `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce
CLERK_SECRET_KEY=sk_test_...
```

## Development Commands

```bash
# Run standalone
pnpm --filter product-service dev

# Type check
pnpm --filter product-service check-types
```
