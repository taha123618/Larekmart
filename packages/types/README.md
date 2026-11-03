# `@repo/types`

Centralized type definitions, Kafka payload contracts, and shared Zod validation schemas for Larekmart.

## Public API & Exports

- **Form Validation Schemas**:
  - `ProductFormSchema`
  - `CategoryFormSchema`
  - `UserFormSchema`
  - `shippingFormSchema`
  - `HomeRecommendationsResponseSchema`, `StrategyMetricSchema`
- **Domain & Persistence Types**:
  - `ProductType`, `ProductsType`
  - `CategoryType`
  - `OrderType`, `OrdersType`, `OrderChartType`
  - `CartItemType`, `CartItemsType`
  - `RecommendationType`, `RecommendationResponseType`, `HomeRecommendationsResponseType`, `StrategyMetricType`
- **Kafka Payload Contracts**:
  - `StripeProductType` (`product.created`)
  - `ProductCreatedType`, `ProductDeletedType`
  - `UserCreatedType` (`user.created`)
  - `OrderCreatedType` (`order.created`)
  - `PaymentSuccessfulType` (`payment.successful`)
- **Shared Constants & Enums**:
  - `colors`, `sizes`, `OrderStatus`
  - `CustomJwtSessionClaims`
  - `GATEWAY_HEADERS` (internal routing, security headers, `FORCE_PRIMARY`, `READ_YOUR_WRITES`, `CLIENT_SESSION_ID`)

## Development Commands

```bash
pnpm --filter @repo/types check-types
pnpm --filter @repo/types test
```
