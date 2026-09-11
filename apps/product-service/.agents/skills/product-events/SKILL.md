---
name: product-events
description: Use when modifying Kafka event publishing for catalog lifecycle events (product.created, product.deleted) in apps/product-service.
---

# Product Event Lifecycle

Guidance for publishing product events from `apps/product-service`.

## 1. Event Contracts

- **`product.created`**:
  - Emitted when a new product record is created.
  - Payload Envelope:
    ```ts
    {
      value: {
        id: product.id.toString(),
        name: product.name,
        price: product.price
      }
    }
    ```
  - Consumer: `payment-service` (creates corresponding Stripe Product and Price).

- **`product.deleted`**:
  - Emitted when a product is deleted.
  - Payload Envelope: `{ value: productId }`
  - Consumer: `payment-service` (archives Stripe Product).

## 2. Producer Best Practices

- Execute database writes before publishing Kafka events.
- Catch publishing errors and log with structured context to prevent unhandled promise rejections.
