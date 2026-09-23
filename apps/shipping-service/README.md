# Shipping Service

Authoritative shipping, carrier integration, tracking, and label generation microservice for Larekmart.

## Port

- Port: `8011`

## Stack

- Node.js + TypeScript
- Koa framework (`koa`, `@koa/router`, `koa-bodyparser`, `@koa/cors`)
- PostgreSQL (`larekmart_shipping_db`) via `@repo/shipping-db` (Prisma)
- Redis for rate and tracking cache (`@repo/redis`)
- Kafka for shipping domain events (`@repo/kafka`)
- Zod for validation (`@repo/types`)

## Architecture

- **Provider Adapters**: TCS, Leopards, DHL, FedEx, Custom/Local behind unified `ShippingProvider` interface.
- **Idempotent Webhooks**: Carrier status webhooks deduplicated via Redis and database.
- **Tracking Timeline**: Append-only historical tracking events.
- **Address Snapshots**: Historical immutable shipping address snapshots on every shipment.

## Endpoints

```
GET    /api/v1/shipping/methods
GET    /api/v1/shipping/rates?city=Karachi&weight=1.5

POST   /api/v1/shipments
GET    /api/v1/shipments/:id
POST   /api/v1/shipments/:id/label
POST   /api/v1/shipments/:id/cancel

GET    /api/v1/shipments/:id/tracking
GET    /api/v1/tracking/:trackingNumber

POST   /api/v1/webhooks/carriers/:carrier

GET    /api/v1/health
GET    /api/v1/health/live
GET    /api/v1/health/ready
```
