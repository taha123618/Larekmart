# `@repo/types`

Centralized type definitions, Kafka payload contracts, and shared Zod validation schemas for Larekmart.

## Public API & Exports

- **Form Validation Schemas**:
  - `ProductFormSchema`
  - `CategoryFormSchema`
  - `UserFormSchema`
  - `shippingFormSchema`
- **Domain & Persistence Types**:
  - `ProductType`, `ProductsType`
  - `CategoryType`
  - `OrderType`, `OrdersType`, `OrderChartType`
  - `CartItemType`, `CartItemsType`
- **Kafka Payload Contracts**:
  - `StripeProductType` (`product.created`)
  - `ProductCreatedType`, `ProductDeletedType`
  - `UserCreatedType` (`user.created`)
  - `OrderCreatedType` (`order.created`)
  - `PaymentSuccessfulType` (`payment.successful`)
- **Shared Constants & Enums**:
  - `colors`, `sizes`, `OrderStatus`
  - `CustomJwtSessionClaims`

## Development Commands

```bash
pnpm --filter @repo/types check-types
```
