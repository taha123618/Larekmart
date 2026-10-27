# Event-driven architecture

Backend services in Larekmart integrate **only** through Kafka. This document is the
contract registry: every topic, its payload, who produces it, and who consumes it.
When you change a payload you must update this file, `@repo/types`, the producer, and
every consumer together.

## Infrastructure

Local Kafka is provided by `packages/kafka/docker-compose.yml`:

- 3 brokers (`confluentinc/cp-kafka:7.5.0`) on `localhost:9094`, `:9095`, `:9096`
- ZooKeeper on `:2181`
- Kafka UI on `http://localhost:8090`
- `KAFKA_CLUSTER_ID`-style fixed `CLUSTER_ID`, replication factor 3 for internal topics

Start it with:

```bash
docker compose -f packages/kafka/docker-compose.yml up -d
```

The client is created with `createKafkaClient(<serviceName>)`, which sets `clientId` and
the three broker addresses (currently hardcoded in `packages/kafka/src/client.ts`).

## Conventions

- **Topic naming:** `<entity>.<past-tense-event>` — `product.created`, `payment.successful`.
- **Payload envelope:** producers always send `{ value: <payload> }`. `@repo/kafka`'s
  `producer.send(topic, message)` JSON-stringifies the object, and the consumer parses it,
  so handlers receive that same object and read **`message.value`**.

  ```ts
  // producer
  producer.send("order.created", { value: { email, amount, status } });

  // consumer
  consumer.subscribe([
    {
      topicName: "order.created",
      topicHandler: async (message) => {
        const { email, amount, status } = message.value;
      },
    },
  ]);
  ```

- **Consumer groups:** one per service (`<service>-group`, or the service name for
  `email-service`). A topic is subscribed once per consumer instance.
- **Delivery:** subscriptions use `fromBeginning: true`. A new consumer group therefore
  replays the topic's history — make handlers tolerant of re-processing.
- **Failure handling:** the consumer wrapper catches errors per message and logs them, so
  one bad message does not stop the loop. There is no dead-letter topic or retry policy
  yet; treat handler failures as observable, not fatal.

## Topic registry

| Topic                             | Producer                   | Consumer(s)                                                                                                   | Payload (`message.value`)                                                                                                                                                                                                                                                           |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.created`                 | product-service            | payment-service, analytic-service, search-service, catalog-service                                            | `ProductCreatedPayload` (superset of `StripeProductType`)                                                                                                                                                                                                                           |
| `product.updated`                 | product-service            | search-service, catalog-service                                                                               | `ProductType`, or `ProductCreatedPayload` on a backfill replay                                                                                                                                                                                                                      |
| `product.deleted`                 | product-service            | payment-service, analytic-service, search-service, catalog-service                                            | `number` (the product id)                                                                                                                                                                                                                                                           |
| `category.created`                | product-service            | catalog-service                                                                                               | `CategoryEventPayload` (`{ id, name, slug }`)                                                                                                                                                                                                                                       |
| `category.updated`                | product-service            | catalog-service                                                                                               | `CategoryEventPayload` (`{ id, name, slug }`)                                                                                                                                                                                                                                       |
| `category.deleted`                | product-service            | catalog-service                                                                                               | `number` (the category id)                                                                                                                                                                                                                                                          |
| `user.created`                    | auth-service               | email-service, analytic-service, notification-service                                                         | `{ username: string, email: string }`                                                                                                                                                                                                                                               |
| `order.created`                   | order-service              | email-service, analytic-service, notification-service, recommendation-service, promotion-service, tax-service | `{ orderId: string, userId: string, email: string, amount: number, status: "pending_confirmation" \| "confirmed" \| "success" \| "failed", products: { name: string, quantity: number, price: number }[], reservationId?: string, couponCode?: string, taxCalculationId?: string }` |
| `order.confirmed`                 | order-service              | cart-service, shipping-service, notification-service, analytic-service                                        | `OrderConfirmedPayload` (`{ orderId, userId, email, amount, paymentSessionId, reservationId, products, confirmedAt }`)                                                                                                                                                              |
| `order.cancelled`                 | order-service              | shipping-service, promotion-service, notification-service, analytic-service, tax-service, inventory-service   | `OrderCancelledPayload` (`{ orderId, userId, reason, cancelledAt }`)                                                                                                                                                                                                                |
| `payment.successful`              | payment-service            | order-service, analytic-service, notification-service, inventory-service, recommendation-service              | `{ sessionId, referenceId, reservationId, userId, email, amount, status, products: { name, quantity, price }[] }`                                                                                                                                                                   |
| `payment.refund.requested`        | order-service              | payment-service                                                                                               | `PaymentRefundRequestedPayload` (`{ orderId, paymentSessionId, amount, reason, userId, requestedAt }`)                                                                                                                                                                              |
| `payment.refund.completed`        | payment-service            | order-service                                                                                                 | `PaymentRefundCompletedPayload` (`{ orderId, refundId, paymentSessionId, amount, status, completedAt }`)                                                                                                                                                                            |
| `notification.dispatch`           | any backend service        | notification-service                                                                                          | `{ userId, type, title, body, email, phone, metadata }`                                                                                                                                                                                                                             |
| `email.dispatch`                  | notification-service       | email-service                                                                                                 | `{ email, subject, text, html, context }`                                                                                                                                                                                                                                           |
| `inventory.created`               | inventory-service          | none yet                                                                                                      | `InventoryChangedPayload`                                                                                                                                                                                                                                                           |
| `inventory.reserved`              | inventory-service          | none yet                                                                                                      | `InventoryChangedPayload` + reservation fields                                                                                                                                                                                                                                      |
| `inventory.reservation.confirmed` | inventory-service          | none yet                                                                                                      | `InventoryChangedPayload` + reservation fields                                                                                                                                                                                                                                      |
| `inventory.reservation.failed`    | inventory-service          | order-service                                                                                                 | `InventoryReservationFailedPayload` (`{ reservationId, referenceId, reason, details, occurredAt }`)                                                                                                                                                                                 |
| `inventory.reservation.cancelled` | order-service              | inventory-service                                                                                             | `InventoryReservationCancelledPayload` (`{ orderId, reservationId, referenceId, reason, cancelledAt }`)                                                                                                                                                                             |
| `inventory.stock.sold`            | inventory-service          | order-service, analytic-service, catalog-service, search-service                                              | `InventoryChangedPayload` + reservation fields                                                                                                                                                                                                                                      |
| `inventory.released`              | inventory-service          | none yet                                                                                                      | `InventoryChangedPayload` + reservation fields                                                                                                                                                                                                                                      |
| `inventory.reservation.expired`   | inventory-service          | none yet                                                                                                      | `InventoryChangedPayload` + reservation fields                                                                                                                                                                                                                                      |
| `inventory.restocked`             | inventory-service          | analytic-service, catalog-service                                                                             | `InventoryChangedPayload`                                                                                                                                                                                                                                                           |
| `inventory.adjusted`              | inventory-service          | cart-service, catalog-service, search-service                                                                 | `InventoryChangedPayload`                                                                                                                                                                                                                                                           |
| `inventory.low_stock`             | inventory-service          | notification-service, analytic-service, catalog-service, search-service                                       | `InventoryChangedPayload`                                                                                                                                                                                                                                                           |
| `cart.created`                    | cart-service               | analytic-service, recommendation-service                                                                      | `CartEventPayload` (`cartId`, `userId`, `guestToken`, `currency`)                                                                                                                                                                                                                   |
| `cart.item_added`                 | cart-service               | analytic-service, recommendation-service                                                                      | `CartEventPayload` (`cartId`, `userId`, `productId`, `variantId`, `quantity`, `unitPrice`)                                                                                                                                                                                          |
| `cart.item_updated`               | cart-service               | analytic-service, recommendation-service                                                                      | `CartEventPayload` (`cartId`, `userId`, `productId`, `variantId`, `quantity`)                                                                                                                                                                                                       |
| `cart.item_removed`               | cart-service               | analytic-service, recommendation-service                                                                      | `CartEventPayload` (`cartId`, `userId`, `productId`, `variantId`, `quantity`)                                                                                                                                                                                                       |
| `cart.merged`                     | cart-service               | analytic-service, recommendation-service                                                                      | `CartEventPayload` (`cartId`, `userId`, `guestToken`, `itemsCount`)                                                                                                                                                                                                                 |
| `cart.coupon_added`               | cart-service               | analytic-service                                                                                              | `CartEventPayload` (`cartId`, `userId`, `couponCode`)                                                                                                                                                                                                                               |
| `cart.coupon_removed`             | cart-service               | analytic-service                                                                                              | `CartEventPayload` (`cartId`, `userId`, `couponCode`)                                                                                                                                                                                                                               |
| `cart.expired`                    | cart-service               | analytic-service, notification-service (abandoned cart recovery)                                              | `CartEventPayload` (`cartId`, `userId`, `guestToken`, `itemsCount`)                                                                                                                                                                                                                 |
| `cart.cleared`                    | cart-service               | analytic-service                                                                                              | `CartEventPayload` (`cartId`, `userId`)                                                                                                                                                                                                                                             |
| `shipment.created`                | shipping-service           | order-service, notification-service, analytic-service                                                         | `ShipmentCreatedPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`, `status`)                                                                                                                                                                                           |
| `shipment.label_created`          | shipping-service           | order-service, notification-service                                                                           | `ShipmentLabelCreatedPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`, `labelUrl`)                                                                                                                                                                                    |
| `shipment.shipped`                | shipping-service           | order-service, notification-service, analytic-service                                                         | `ShipmentShippedPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`, `shippedAt`)                                                                                                                                                                                        |
| `shipment.in_transit`             | shipping-service           | notification-service                                                                                          | `ShipmentInTransitPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`, `location`)                                                                                                                                                                                       |
| `shipment.out_for_delivery`       | shipping-service           | notification-service                                                                                          | `ShipmentOutForDeliveryPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`)                                                                                                                                                                                              |
| `shipment.delivered`              | shipping-service           | order-service, notification-service, analytic-service                                                         | `ShipmentDeliveredPayload` (`shipmentId`, `orderId`, `carrier`, `trackingNumber`, `deliveredAt`)                                                                                                                                                                                    |
| `shipment.cancelled`              | shipping-service           | order-service, notification-service                                                                           | `ShipmentCancelledPayload` (`shipmentId`, `orderId`, `reason`)                                                                                                                                                                                                                      |
| `shipment.failed`                 | shipping-service           | order-service, notification-service                                                                           | `ShipmentFailedPayload` (`shipmentId`, `orderId`, `reason`)                                                                                                                                                                                                                         |
| `tracking.updated`                | shipping-service           | notification-service, analytic-service                                                                        | `TrackingUpdatedPayload` (`shipmentId`, `trackingNumber`, `carrier`, `status`, `description`, `location`)                                                                                                                                                                           |
| `user.created`                    | auth-service / Clerk       | user-service, recommendation-service, analytic-service                                                        | `UserEventPayload` (`eventId`, `eventType`, `userId`, `email`, `data`)                                                                                                                                                                                                              |
| `auth.user_created`               | auth-service               | user-service                                                                                                  | `UserEventPayload` (`eventId`, `eventType`, `userId`, `email`, `data`)                                                                                                                                                                                                              |
| `user.registered`                 | auth-service               | user-service, notification-service                                                                            | `UserEventPayload` (`eventId`, `eventType`, `userId`, `email`, `data`)                                                                                                                                                                                                              |
| `user.updated`                    | user-service               | recommendation-service, notification-service, analytic-service                                                | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `fields`)                                                                                                                                                                                                             |
| `user.profile_updated`            | user-service               | recommendation-service, notification-service                                                                  | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `firstName`, `lastName`, `avatarUrl`)                                                                                                                                                                                 |
| `user.address_created`            | user-service               | analytic-service                                                                                              | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `addressId`, `type`, `isDefault`)                                                                                                                                                                                     |
| `user.address_updated`            | user-service               | analytic-service                                                                                              | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `addressId`, `fields`)                                                                                                                                                                                                |
| `user.address_deleted`            | user-service               | analytic-service                                                                                              | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `addressId`)                                                                                                                                                                                                          |
| `user.preferences_updated`        | user-service               | recommendation-service, notification-service                                                                  | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `preferredLanguage`, `currency`, `marketingEmail`)                                                                                                                                                                    |
| `user.deletion_requested`         | user-service               | auth-service, recommendation-service, notification-service, analytic-service                                  | `UserEventPayload` (`eventId`, `eventType`, `userId`, `data`: `requestedAt`)                                                                                                                                                                                                        |
| `user.deleted`                    | user-service               | auth-service, recommendation-service, notification-service, analytic-service, media-service                   | `UserEventPayload` (`eventId`, `eventType`, `userId`)                                                                                                                                                                                                                               |
| `media.upload_requested`          | media-service              | none yet                                                                                                      | `MediaEventPayloadType` (`eventId`, `eventType`, `mediaId`, `ownerType`, `ownerId`, …)                                                                                                                                                                                              |
| `media.uploaded`                  | media-service              | analytic-service                                                                                              | `MediaEventPayloadType` (`eventId`, `eventType`, `mediaId`, `ownerType`, `ownerId`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`)                                                                                                                                                 |
| `media.processing_started`        | media-service              | none yet                                                                                                      | `MediaEventPayloadType`                                                                                                                                                                                                                                                             |
| `media.processing_completed`      | media-service              | analytic-service, product/catalog services (optional)                                                         | `MediaEventPayloadType` (+ `width`, `height`, `checksum`)                                                                                                                                                                                                                           |
| `media.processing_failed`         | media-service              | analytic-service                                                                                              | `MediaEventPayloadType` (+ `error`)                                                                                                                                                                                                                                                 |
| `media.deleted`                   | media-service              | analytic-service                                                                                              | `MediaEventPayloadType`                                                                                                                                                                                                                                                             |
| `media.quarantined`               | media-service              | analytic-service, notification-service (optional)                                                             | `MediaEventPayloadType` (+ `error`)                                                                                                                                                                                                                                                 |
| `review.created`                  | review-service             | analytic-service, recommendation-service, notification-service (seller alert)                                 | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`, `rating`, `title`, `isVerifiedPurchase`)                                                                                                                                                           |
| `review.updated`                  | review-service             | analytic-service                                                                                              | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`, `rating`, `title`)                                                                                                                                                                                 |
| `review.deleted`                  | review-service             | analytic-service, media-service                                                                               | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`)                                                                                                                                                                                                    |
| `review.approved`                 | review-service             | analytic-service, notification-service                                                                        | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`)                                                                                                                                                                                                    |
| `review.rejected`                 | review-service             | analytic-service, notification-service                                                                        | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`)                                                                                                                                                                                                    |
| `review.reported`                 | review-service             | notification-service (admin alert), admin / moderation queue                                                  | `ReviewEventPayload` (`eventId`, `eventType`, `reviewId`, `productId`, `userId`, `reason`)                                                                                                                                                                                          |
| `product.rating-summary.updated`  | review-service             | search-service, catalog-service, analytic-service                                                             | `ProductRatingSummaryEventPayload` (`eventId`, `productId`, `averageRating`, `totalReviews`, `verifiedPurchasesCount`, `distribution`)                                                                                                                                              |
| `wishlist.created`                | wishlist-service           | analytic-service                                                                                              | `WishlistCreatedEvent` (`wishlistId`, `userId`, `name`, `isDefault`, `visibility`)                                                                                                                                                                                                  |
| `wishlist.item.added`             | wishlist-service           | analytic-service, recommendation-service                                                                      | `WishlistItemAddedEvent` (`wishlistId`, `itemId`, `userId`, `productId`, `variantId`, `addedPrice`)                                                                                                                                                                                 |
| `wishlist.item.removed`           | wishlist-service           | analytic-service                                                                                              | `WishlistItemRemovedEvent` (`wishlistId`, `itemId`, `userId`, `productId`, `variantId`)                                                                                                                                                                                             |
| `wishlist.item.moved`             | wishlist-service           | analytic-service                                                                                              | `WishlistItemMovedEvent` (`sourceWishlistId`, `targetWishlistId`, `itemId`, `userId`, `productId`)                                                                                                                                                                                  |
| `wishlist.merged`                 | wishlist-service           | analytic-service                                                                                              | `WishlistMergedEvent` (`userId`, `guestId`, `wishlistId`, `mergedCount`)                                                                                                                                                                                                            |
| `wishlist.price-drop`             | wishlist-service           | notification-service                                                                                          | `WishlistPriceDropAlertEvent` (`userId`, `wishlistId`, `itemId`, `productId`, `oldPrice`, `newPrice`, `dropPercentage`)                                                                                                                                                             |
| `wishlist.restocked`              | wishlist-service           | notification-service                                                                                          | `WishlistRestockedAlertEvent` (`userId`, `wishlistId`, `itemId`, `productId`, `availableQuantity`)                                                                                                                                                                                  |
| `promotion.created`               | promotion-service          | analytic-service                                                                                              | `PromotionCreatedEventPayload` (`promotionId`, `name`, `type`, `discountType`, `discountValue`, `scope`, `startDate`, `endDate`)                                                                                                                                                    |
| `promotion.activated`             | promotion-service          | analytic-service, notification-service (deal alerts)                                                          | `PromotionActivatedEventPayload` (`promotionId`, `name`, `type`)                                                                                                                                                                                                                    |
| `promotion.deactivated`           | promotion-service          | analytic-service                                                                                              | `PromotionDeactivatedEventPayload` (`promotionId`, `name`, `reason`)                                                                                                                                                                                                                |
| `promotion.budget_exhausted`      | promotion-service          | analytic-service, notification-service (admin alert)                                                          | `PromotionBudgetExhaustedEventPayload` (`promotionId`, `budgetLimit`, `totalSpent`, `currency`)                                                                                                                                                                                     |
| `promotion.reserved`              | promotion-service          | order-service, analytic-service                                                                               | `PromotionReservedEventPayload` (`reservationId`, `promotionId`, `orderId`, `userId`, `couponCode`, `discountAmount`, `expiresAt`)                                                                                                                                                  |
| `promotion.redeemed`              | promotion-service          | order-service, analytic-service, email-service                                                                | `PromotionRedeemedEventPayload` (`redemptionId`, `promotionId`, `orderId`, `userId`, `couponCode`, `discountAmount`)                                                                                                                                                                |
| `promotion.released`              | promotion-service          | order-service, analytic-service                                                                               | `PromotionReleasedEventPayload` (`reservationId`, `promotionId`, `orderId`, `reason`)                                                                                                                                                                                               |
| `tax.calculation.completed`       | tax-service                | analytic-service, order-service, notification-service                                                         | `TaxCalculationCompletedEventPayload` (`calculationId`, `referenceId`, `referenceType`, `currency`, `subtotal`, `taxTotal`, `total`, `ruleVersion`)                                                                                                                                 |
| `tax.calculation.failed`          | tax-service                | order-service, analytic-service                                                                               | `TaxCalculationFailedEventPayload` (`referenceId`, `referenceType`, `error`, `failedAt`, `calculationId?`)                                                                                                                                                                          |
| `tax.calculation.voided`          | order-service, tax-service | tax-service, analytic-service                                                                                 | `TaxCalculationVoidedEventPayload` (`calculationId`, `referenceId`, `referenceType`, `reason`, `voidedAt`)                                                                                                                                                                          |
| `tax.rules.updated`               | tax-service                | tax-service (cache eviction), analytic-service                                                                | `TaxRulesUpdatedEventPayload` (`version`, `ruleIds`, `timestamp`)                                                                                                                                                                                                                   |
| `tax.calculation.adjusted`        | tax-service                | analytic-service, email-service, order-service                                                                | `TaxCalculationAdjustedEventPayload` (`returnCalculationId`, `originalCalculationId`, `referenceId`, `taxRefundTotal`, `adjustedAt`)                                                                                                                                                |
| `return.requested`                | return-service             | order-service, notification-service, analytic-service                                                         | `ReturnRequestedEventPayload` (`returnId`, `orderId`, `customerId`, `sellerId`, `totalRefund`, `currency`, `itemsCount`)                                                                                                                                                            |
| `return.approved`                 | return-service             | shipping-service, notification-service, email-service                                                         | `ReturnApprovedEventPayload` (`returnId`, `orderId`, `customerId`, `approvedAt`, `autoApproved`)                                                                                                                                                                                    |
| `return.rejected`                 | return-service             | notification-service, email-service                                                                           | `ReturnRejectedEventPayload` (`returnId`, `orderId`, `customerId`, `rejectedAt`, `reason`)                                                                                                                                                                                          |
| `return.cancelled`                | return-service             | notification-service, analytic-service                                                                        | `ReturnCancelledEventPayload` (`returnId`, `orderId`, `customerId`, `cancelledAt`)                                                                                                                                                                                                  |
| `return.shipment.requested`       | return-service             | shipping-service                                                                                              | `ReturnShipmentRequestedEventPayload` (`returnId`, `orderId`, `customerId`, `sellerId`, `items`)                                                                                                                                                                                    |
| `return.inspection.completed`     | return-service             | inventory-service, analytic-service                                                                           | `ReturnInspectionCompletedEventPayload` (`returnId`, `orderId`, `overallCondition`, `disposition`)                                                                                                                                                                                  |
| `return.refund.requested`         | return-service             | payment-service                                                                                               | `ReturnRefundRequestedEventPayload` (`returnId`, `orderId`, `paymentIntentId`, `amount`, `currency`, `idempotencyKey`)                                                                                                                                                              |
| `return.completed`                | return-service             | order-service, notification-service, email-service, analytic-service                                          | `ReturnCompletedEventPayload` (`returnId`, `orderId`, `customerId`, `paymentIntentId`, `amount`, `currency`, `refundedAt`)                                                                                                                                                          |
| `vendor.registered`               | vendor-service             | notification-service, email-service, analytic-service                                                         | `VendorRegisteredEvent` (`vendorId`, `ownerUserId`, `legalName`, `country`, `status`, `registeredAt`)                                                                                                                                                                               |
| `vendor.verification.requested`   | vendor-service             | notification-service, analytic-service                                                                        | `VendorVerificationRequestedEvent` (`vendorId`, `workflowType`, `requestedAt`)                                                                                                                                                                                                      |
| `vendor.verified`                 | vendor-service             | user-service, notification-service, email-service, analytic-service                                           | `VendorVerifiedEvent` (`vendorId`, `verifiedAt`, `reviewerAdminId`)                                                                                                                                                                                                                 |
| `vendor.rejected`                 | vendor-service             | notification-service, email-service, analytic-service                                                         | `VendorRejectedEvent` (`vendorId`, `rejectedAt`, `reason`, `deficiencies`)                                                                                                                                                                                                          |
| `vendor.suspended`                | vendor-service             | notification-service, email-service, analytic-service                                                         | `VendorSuspendedEvent` (`vendorId`, `suspendedAt`, `reason`)                                                                                                                                                                                                                        |
| `vendor.reactivated`              | vendor-service             | notification-service, email-service, analytic-service                                                         | `VendorReactivatedEvent` (`vendorId`, `reactivatedAt`)                                                                                                                                                                                                                              |
| `seller.created`                  | seller-service             | user-service, notification-service, email-service, analytic-service                                           | `SellerCreatedEvent` (`sellerId`, `vendorId`, `primaryUserId`, `storeName`, `slug`, `status`, `createdAt`)                                                                                                                                                                          |
| `seller.activated`                | seller-service             | user-service, notification-service, email-service, analytic-service                                           | `SellerActivatedEvent` (`sellerId`, `vendorId`, `activatedAt`, `activatedByUserId`)                                                                                                                                                                                                 |
| `seller.updated`                  | seller-service             | notification-service, analytic-service                                                                        | `SellerUpdatedEvent` (`sellerId`, `updatedFields`, `updatedAt`)                                                                                                                                                                                                                     |
| `seller.suspended`                | seller-service             | notification-service, email-service, analytic-service                                                         | `SellerSuspendedEvent` (`sellerId`, `vendorId`, `reason`, `suspendedAt`)                                                                                                                                                                                                            |
| `seller.storefront.updated`       | seller-service             | notification-service, analytic-service                                                                        | `SellerStorefrontUpdatedEvent` (`sellerId`, `storeId`, `storeName`, `slug`, `vacationMode`, `status`, `updatedAt`)                                                                                                                                                                  |

### `product.created`

Emitted after a product row is written. Used to mirror the catalog into Stripe and index into OpenSearch.

The payload is the full product (`ProductCreatedPayload`), a superset of `StripeProductType`.
The rich fields let search-service index images, sizes, and colors immediately — a freshly
created product is searchable with facets without waiting for an update event — while
payment-service still finds the `id`/`name`/`price` it mirrors into Stripe.

The `images` map holds **media references** (`color → "media:<uuid>"`) rather than storage
URLs. media-service consumes `product.created`/`product.updated` to claim the referenced
media rows (assigning `ownerType=product`), and frontends resolve references to URLs via
`POST /api/v1/media/resolve`. Legacy URL values are passed through by resolvers, so
pre-existing products keep rendering.

```jsonc
{
  "value": {
    "id": "42",
    "name": "Adidas CoreFit T-Shirt",
    "price": 59,
    "shortDescription": "Soft cotton tee",
    "description": "Soft cotton tee with a relaxed fit.",
    "categorySlug": "t-shirts",
    "sizes": ["s", "m", "l"],
    "colors": ["black", "white"],
    "images": { "black": "/products/1bl.png", "white": "/products/1w.png" },
    "createdAt": "2026-09-13T10:00:00.000Z",
    "updatedAt": "2026-09-13T10:00:00.000Z",
  },
}
```

- Producer: `apps/product-service/src/controllers/product.controller.ts`
- Consumer: `apps/payment-service/src/utils/subscriptions.ts`, `apps/search-service/src/consumers/product-events.consumer.ts`, `apps/recommendation-service/app/messaging/consumers/event_consumer.py`

### `product.updated`

Emitted after a product row is updated. Used to update the denormalized document in OpenSearch.

```jsonc
{ "value": { "id": 42, "name": "Adidas CoreFit T-Shirt Pro", "price": 65 } }
```

The consumer fills anything missing with defaults, so a partial update leaves `images`,
`sizes`, and `colors` as they were. Send the whole product when a change affects what the
storefront renders or facets on.

`product-service` also **replays the catalog on this topic** to heal documents that were
indexed before `product.created` carried the full product
(`pnpm --filter product-service backfill:search`); those replays send
`ProductCreatedPayload`. search-service is the only consumer today, so a full replay has no
side effects on other services — but if you subscribe a new service here, remember it can
receive the entire catalog at once.

- Producer: `apps/product-service/src/controllers/product.controller.ts`, `apps/product-service/src/search/backfill.ts`
- Consumer: `apps/search-service/src/consumers/product-events.consumer.ts`, `apps/recommendation-service/app/messaging/consumers/event_consumer.py`

### `product.deleted`

Emitted after a product is deleted; carries the numeric id.

```jsonc
{ "value": 42 }
```

- Producer: `apps/product-service/src/controllers/product.controller.ts`
- Consumer: `apps/payment-service/src/utils/subscriptions.ts`, `apps/search-service/src/consumers/product-events.consumer.ts`, `apps/recommendation-service/app/messaging/consumers/event_consumer.py`

- Consumer: `deleteStripeProduct` in payment-service.

### `category.created` / `category.updated` / `category.deleted`

Emitted after a category row is written in product-service so catalog-service can keep its
`CatalogCategory` read model — and therefore the category tree, category pages, and the
`?category=` filter — in step with the source of truth.

```jsonc
{ "value": { "id": 3, "name": "Shoes", "slug": "shoes" } }
```

```jsonc
{ "value": 3 }
```

The catalog projector keys the read-model row by the **same id** as the product-service
category, so a projected category's `id` is directly usable in `?category=<id>`. Only
id/name/slug are carried because that is all the `Category` model stores; catalog-service
defaults the remaining read-model fields (description, image, parentId, position, isActive)
and matches products to the category by `slug` (via `products.categorySlug`).

Because `product.created` carries `categorySlug`, categories must be projected **before**
products to be linked; a product that arrives first keeps `primaryCategoryId = null` until
the category is projected.

- Producer: `apps/product-service/src/controllers/category.controller.ts`
- Consumer: `apps/catalog-service/src/consumers/category.consumer.ts` → `CategoryProjector`

### `user.created`

Emitted after `clerkClient.users.createUser` succeeds.

```jsonc
{ "value": { "username": "johndoe", "email": "johndoe@example.com" } }
```

- Producer: `apps/auth-service/src/routes/user.route.ts`
- Consumer: `apps/email-service/src/index.ts` → welcome email.

### `order.created`

Emitted after an order is persisted. Note `amount` is in the smallest currency unit
(cents) as returned by Stripe.

```jsonc
{
  "value": {
    "orderId": "660c1d2e...",
    "userId": "user_...",
    "email": "johndoe@example.com",
    "amount": 5990,
    "status": "success",
    "products": [{ "name": "CoreFit T-Shirt", "quantity": 1, "price": 5900 }],
  },
}
```

- Producer: `apps/order-service/src/outbox/outbox-relay.ts` (Transactional Outbox relay with atomic MongoDB transactions & background lease-locked sweeper)
- Consumers:
  - `apps/email-service/src/index.ts` → order confirmation email (`amount / 100`).
  - `apps/recommendation-service/app/messaging/consumers/event_consumer.py` → behavioral order interaction.
  - `apps/promotion-service/src/events/consumers/order-events.consumer.ts` → commits checkout promotion reservation upon order creation.

### `payment.successful`

Emitted from the verified Stripe webhook on `checkout.session.completed`.

```jsonc
{
  "value": {
    "sessionId": "cs_test_...",
    "referenceId": "cs_test_...",
    "reservationId": "res_...",
    "userId": "user_...",
    "email": "johndoe@example.com",
    "amount": 5990,
    "status": "success",
    "products": [{ "name": "CoreFit T-Shirt", "quantity": 1, "price": 5900 }],
  },
}
```

- Producer: `apps/payment-service/src/routes/webhooks.route.ts`
- Consumers:
  - `apps/order-service/src/utils/subscriptions.ts` → `createOrder`
  - `apps/inventory-service/src/workers/inventory-event.consumer.ts` → `confirmReservationsByReference` (converts reserved stock to sold stock)

### `order.confirmed`

Emitted from `order-service` when `inventory.stock.sold` confirms that stock has been successfully debited for the order's reservation.

```jsonc
{
  "value": {
    "orderId": "650f1234567890abcdef1234",
    "userId": "user_2aX...",
    "email": "customer@example.com",
    "paymentSessionId": "cs_test_...",
    "reservationId": "res_...",
    "amount": 5990,
    "products": [
      {
        "productId": "12",
        "name": "Classic Oxford Shirt",
        "quantity": 1,
        "price": 5990,
      },
    ],
    "confirmedAt": "2026-10-27T12:00:00.000Z",
  },
}
```

- Producer: `apps/order-service/src/utils/order.ts` (`confirmOrder`)
- Consumers:
  - `apps/cart-service` → converts/clears user cart
  - `apps/shipping-service` → initiates shipment creation
  - `apps/notification-service` → dispatches customer order confirmation notice
  - `apps/analytic-service` → records confirmed conversion metrics

### `order.cancelled`

Emitted from `order-service` when a checkout order is cancelled (e.g. inventory reservation failed, timeout expired, or customer initiated cancellation).

```jsonc
{
  "value": {
    "orderId": "650f1234567890abcdef1234",
    "userId": "user_2aX...",
    "reason": "Stock reservation failed: INSUFFICIENT_STOCK",
    "cancelledAt": "2026-10-27T12:00:00.000Z",
  },
}
```

- Producer: `apps/order-service/src/utils/order.ts` (`cancelOutOfStockOrder`)
- Consumers:
  - `apps/shipping-service` → cancels any pending shipment
  - `apps/promotion-service` → releases coupon and promotional reservations
  - `apps/notification-service` → sends cancellation notification to customer
  - `apps/analytic-service` → logs cancellation event

### `payment.refund.requested`

Emitted by `order-service` when an order cannot be confirmed (due to out-of-stock reservation failure or timeout), triggering an automated compensation refund in `payment-service`.

```jsonc
{
  "value": {
    "orderId": "650f1234567890abcdef1234",
    "paymentSessionId": "cs_test_...",
    "amount": 5990,
    "reason": "Stock reservation failed: INSUFFICIENT_STOCK",
    "userId": "user_2aX...",
    "requestedAt": "2026-10-27T12:00:00.000Z",
  },
}
```

- Producer: `apps/order-service/src/utils/order.ts`
- Consumer: `apps/payment-service/src/utils/refund.handler.ts` → executes `stripe.refunds.create`

### `payment.refund.completed`

Emitted by `payment-service` after executing the Stripe compensation refund.

```jsonc
{
  "value": {
    "orderId": "650f1234567890abcdef1234",
    "refundId": "re_...",
    "paymentSessionId": "cs_test_...",
    "amount": 5990,
    "status": "succeeded",
    "completedAt": "2026-10-27T12:00:00.000Z",
  },
}
```

- Producer: `apps/payment-service/src/utils/refund.handler.ts`
- Consumer: `apps/order-service/src/utils/subscriptions.ts` → marks order `status: "refunded"`

### `cart.*` (`cart.item_added`, `cart.merged`, `cart.expired`, etc.)

Emitted whenever cart lifecycle actions occur in `cart-service`. Enables decoupled analytics, user recommendation telemetry, and automated abandoned cart recovery workflows without polling.

```jsonc
{
  "value": {
    "eventId": "123e4567-e89b-12d3-a456-426614174000",
    "eventType": "cart.item_added",
    "cartId": "650f1234567890abcdef1234",
    "userId": "user_2aX...",
    "guestToken": null,
    "productId": "prod_123",
    "variantId": "var_456",
    "quantity": 2,
    "unitPrice": 29999,
    "subtotal": 59998,
    "timestamp": "2026-09-19T15:00:00.000Z",
  },
}
```

- Producer: `apps/cart-service/src/publishers/cart.publisher.ts`
- Potential Consumers:
  - `apps/analytic-service` → cart abandonment rates, popular cart items, add-to-cart conversion funnel.
  - `apps/recommendation-service` → real-time collaborative filtering & cross-selling recommendations.
  - `apps/notification-service` → abandoned cart emails/pushes after `cart.expired`.

### `shipment.*` (`shipment.created`, `shipment.shipped`, `shipment.delivered`, etc.)

Emitted as a package transitions across its lifecycle states in `shipping-service`.
Allows `order-service` to mirror shipment status without tight coupling, triggers multi-channel delivery updates in `notification-service`, and feeds logistics performance metrics to `analytic-service`.

```jsonc
{
  "value": {
    "eventId": "123e4567-e89b-12d3-a456-426614174000",
    "eventType": "shipment.delivered",
    "shipmentId": "ship_abc123",
    "orderId": "660c1d2e...",
    "carrier": "tcs",
    "trackingNumber": "TCS789456123",
    "deliveredAt": "2026-09-24T12:00:00.000Z",
    "timestamp": "2026-09-24T12:00:01.000Z",
  },
}
```

- Producer: `apps/shipping-service/src/publishers/shipping.publisher.ts`
- Consumers:
  - `apps/order-service` → updates order fulfillment status.
  - `apps/notification-service` → sends delivery notification (SMS / WhatsApp / Email / In-App).
  - `apps/analytic-service` → tracks carrier delivery times and SLA fulfillment.

### `tracking.updated`

Emitted whenever carrier webhooks or status checks record a granular milestone event along the package route.

```jsonc
{
  "value": {
    "eventId": "evt_98765",
    "eventType": "tracking.updated",
    "shipmentId": "ship_abc123",
    "trackingNumber": "TCS789456123",
    "carrier": "tcs",
    "status": "IN_TRANSIT",
    "description": "Shipment arrived at central sorting facility",
    "location": "Lahore Sorting Hub",
    "occurredAt": "2026-09-24T09:30:00.000Z",
    "timestamp": "2026-09-24T09:30:05.000Z",
  },
}
```

- Producer: `apps/shipping-service/src/publishers/shipping.publisher.ts`
- Consumers:
  - `apps/notification-service` → real-time tracking updates via WebSockets.
  - `apps/analytic-service` → transit duration analytics per carrier and lane.

### `media.*` lifecycle events

media-service emits a `MediaEventPayloadType` (see `@repo/types/src/media.ts`) on every
lifecycle transition, always with the repository envelope `{ value: payload }`:

```jsonc
{
  "value": {
    "eventId": "evt_555",
    "eventType": "media.processing_completed",
    "mediaId": "0f0a1b2c-…",
    "ownerType": "product",
    "ownerId": "42",
    "bucket": "media",
    "objectKey": "products/42/0f0a1b2c-…/original.jpg",
    "mimeType": "image/jpeg",
    "sizeBytes": 248931,
    "width": 1600,
    "height": 1600,
    "checksum": "sha256-…",
    "occurredAt": "2026-09-30T00:00:00.000Z",
  },
}
```

- Producer: `apps/media-service/src/messaging/publishers/media.publisher.ts`
- Consumer (inbound, idempotent via `processed_events`): media-service consumes
  `product.deleted`, `seller.deleted`, `review.deleted`, `user.deleted`,
  `category.deleted`, `brand.deleted` and soft-deletes the associated media
  (`apps/media-service/src/messaging/consumers/domain-deletion.consumer.ts`).
  Producers without an `eventId` are deduplicated by a deterministic
  `<topic>:<ownerType>:<ownerId>` key.

### `tax-service` events

#### `tax.calculation.completed`

Emitted after a tax quote or calculation is officially settled against an order or finalized transaction.

```jsonc
{
  "value": {
    "calculationId": "calc_9a1b2c3d-…",
    "referenceId": "ord_67890",
    "referenceType": "order",
    "currency": "USD",
    "subtotal": "120.00",
    "taxTotal": "10.50",
    "total": "130.50",
    "ruleVersion": "2026-10",
    "completedAt": "2026-10-16T03:00:00.000Z",
  },
}
```

- **Producer:** `apps/tax-service/src/events/producers/tax.producer.ts`
- **Consumers:** `analytic-service` (tracks tax revenue and calculation counts), `order-service` (records tax completion), `notification-service`.

#### `tax.calculation.adjusted`

Emitted after a return or refund causes proportional tax reimbursement to be calculated.

```jsonc
{
  "value": {
    "returnCalculationId": "ret_calc_12345",
    "originalCalculationId": "calc_9a1b2c3d-…",
    "referenceId": "ord_67890",
    "taxRefundTotal": "3.50",
    "adjustedAt": "2026-10-16T03:30:00.000Z",
  },
}
```

- **Producer:** `apps/tax-service/src/events/producers/tax.producer.ts`
- **Consumers:** `analytic-service` (adjusts tax revenue downwards), `email-service` (receipt notifications), `order-service`.

#### `tax.rules.updated`

Emitted when an administrator activates or modifies versioned tax rules, broadcasting cache invalidation across the cluster.

```jsonc
{
  "value": {
    "version": "2026-11",
    "ruleIds": ["rule_ca_std_01", "rule_ny_dig_02"],
    "timestamp": "2026-10-16T03:45:00.000Z",
  },
}
```

- **Producer:** `apps/tax-service/src/events/producers/tax.producer.ts`
- **Consumers:** `tax-service` (evicts local Redis rule caches), `analytic-service`.

#### `return.requested`

Emitted when a customer submits a valid return request.

```jsonc
{
  "value": {
    "returnId": "ret_9a1c8f3e-2b4a-4d9f-9231-1e9a4f783241",
    "orderId": "order_789123",
    "customerId": "user_2aBcDeFgHiJkLmNoPqRsTuVwX",
    "sellerId": "seller_abc123",
    "totalRefund": "89.50",
    "currency": "USD",
    "itemsCount": 2,
    "requestedAt": "2026-10-21T01:30:00.000Z",
  },
}
```

- **Producer:** `apps/return-service/src/services/return.service.ts` (via outbox)
- **Consumers:** `order-service`, `notification-service`, `analytic-service`.

#### `return.approved`

Emitted when an authorized admin (or automated policy) approves a return request.

```jsonc
{
  "value": {
    "returnId": "ret_9a1c8f3e-2b4a-4d9f-9231-1e9a4f783241",
    "orderId": "order_789123",
    "customerId": "user_2aBcDeFgHiJkLmNoPqRsTuVwX",
    "approvedAt": "2026-10-21T01:35:00.000Z",
    "autoApproved": false,
  },
}
```

- **Producer:** `apps/return-service/src/services/admin-return.service.ts` (via outbox)
- **Consumers:** `shipping-service`, `notification-service`, `email-service`.

#### `return.refund.requested`

Emitted to request payment-service to process an asynchronous Stripe refund.

```jsonc
{
  "value": {
    "returnId": "ret_9a1c8f3e-2b4a-4d9f-9231-1e9a4f783241",
    "orderId": "order_789123",
    "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
    "amount": "89.50",
    "currency": "USD",
    "idempotencyKey": "refund_ret_9a1c8f3e_1729474500",
  },
}
```

- **Producer:** `apps/return-service/src/services/admin-return.service.ts` (via outbox)
- **Consumers:** `payment-service`.

#### `return.completed`

Emitted after Stripe confirms successful refund execution and the return lifecycle concludes.

```jsonc
{
  "value": {
    "returnId": "ret_9a1c8f3e-2b4a-4d9f-9231-1e9a4f783241",
    "orderId": "order_789123",
    "customerId": "user_2aBcDeFgHiJkLmNoPqRsTuVwX",
    "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
    "amount": "89.50",
    "currency": "USD",
    "refundedAt": "2026-10-21T01:40:00.000Z",
  },
}
```

- **Producer:** `apps/return-service/src/workers/consumers.ts` (via outbox)
- **Consumers:** `order-service`, `notification-service`, `email-service`, `analytic-service`.

#### `pricing.price.created`

Emitted when a new base product price or variant price is established in pricing-service.

```jsonc
{
  "value": {
    "priceId": "d3b07384-d113-460b-8d82-0199d690a789",
    "priceListId": "b1a07384-d113-460b-8d82-0199d690a123",
    "productId": "42",
    "basePrice": 49.99,
    "currency": "USD",
    "timestamp": "2026-10-21T18:00:00.000Z",
  },
}
```

- **Producer:** `apps/pricing-service/src/services/pricing.service.ts`, `apps/pricing-service/src/kafka/consumer.ts`
- **Consumers:** `catalog-service`, `search-service`.

#### `pricing.price.updated`

Emitted when a product or variant's base price or compare-at price is changed in pricing-service.

```jsonc
{
  "value": {
    "priceId": "d3b07384-d113-460b-8d82-0199d690a789",
    "productId": "42",
    "oldPrice": 49.99,
    "newPrice": 39.99,
    "compareAtPrice": 59.99,
    "currency": "USD",
    "changeReason": "Holiday Flash Sale",
    "timestamp": "2026-10-21T18:30:00.000Z",
  },
}
```

- **Producer:** `apps/pricing-service/src/services/pricing.service.ts`
- **Consumers:** `cart-service` (recalculates active cart lines), `catalog-service` (updates read model & Redis cache), `search-service` (updates OpenSearch document partial), `wishlist-service` (triggers price drop alerts).

#### `pricing.quote.created`

Emitted when an authoritative pricing quote is generated and persisted for checkout or order creation.

```jsonc
{
  "value": {
    "quoteId": "quote_1792604000_abc123",
    "currency": "USD",
    "subtotal": 89.99,
    "totalDiscount": 10.0,
    "promotionDiscount": 5.0,
    "finalTotal": 74.99,
    "customerGroup": "registered_user",
    "itemCount": 2,
    "timestamp": "2026-10-21T18:45:00.000Z",
  },
}
```

- **Producer:** `apps/pricing-service/src/services/quote.service.ts`
- **Consumers:** `analytic-service`.

#### `vendor.registered`

Emitted when a new business entity registers and submits initial information.

```jsonc
{
  "value": {
    "vendorId": "vnd_8492049102",
    "legalName": "Apex Technologies LLC",
    "taxId": "XX-XXXXXXX",
    "country": "US",
    "status": "PENDING_VERIFICATION",
    "contactEmail": "admin@apextech.com",
    "timestamp": "2026-10-22T02:00:00.000Z",
  },
}
```

- **Producer:** `apps/vendor-service/src/modules/vendors/vendors.service.ts`
- **Consumers:** `notification-service` (alerts admin of new submission), `email-service` (sends confirmation email), `analytic-service` (increments registration KPIs).

#### `vendor.verified`

Emitted when an administrator or verification provider completes KYB approval.

```jsonc
{
  "value": {
    "vendorId": "vnd_8492049102",
    "legalName": "Apex Technologies LLC",
    "status": "VERIFIED",
    "contactEmail": "admin@apextech.com",
    "verifiedAt": "2026-10-22T02:15:00.000Z",
    "reviewedBy": "admin_clerk_id",
  },
}
```

- **Producer:** `apps/vendor-service/src/modules/admin/admin-vendors.service.ts`
- **Consumers:** `user-service` (promotes user profile `isSeller: true`), `notification-service`, `email-service`, `analytic-service`.

#### `vendor.rejected`

Emitted when KYB documentation is rejected or requires correction.

```jsonc
{
  "value": {
    "vendorId": "vnd_8492049102",
    "legalName": "Apex Technologies LLC",
    "status": "REJECTED",
    "reason": "Business registration document expired",
    "contactEmail": "admin@apextech.com",
    "reviewedBy": "admin_clerk_id",
  },
}
```

- **Producer:** `apps/vendor-service/src/modules/admin/admin-vendors.service.ts`
- **Consumers:** `notification-service`, `email-service`.

#### `seller.created`

Emitted when a new storefront profile is initialized under a verified vendor entity.

```jsonc
{
  "value": {
    "sellerId": "sel_019a2b3c4d5e",
    "vendorId": "vnd_8492049102",
    "storeName": "Apex Gadgets Official",
    "slug": "apex-gadgets",
    "contactEmail": "store@apextech.com",
    "createdAt": "2026-10-22T02:20:00.000Z",
  },
}
```

- **Producer:** `apps/seller-service/src/routes/seller.routes.ts`
- **Consumers:** `user-service` (promotes user profile `isSeller: true`), `notification-service`, `email-service`, `analytic-service`.

#### `seller.activated`

Emitted when a storefront becomes active and eligible to receive customer orders.

```jsonc
{
  "value": {
    "sellerId": "sel_019a2b3c4d5e",
    "storeName": "Apex Gadgets Official",
    "slug": "apex-gadgets",
    "status": "ACTIVE",
    "activatedAt": "2026-10-22T02:25:00.000Z",
  },
}
```

- **Producer:** `apps/seller-service/src/routes/admin.routes.ts`
- **Consumers:** `user-service` (promotes user profile `isSeller: true`), `notification-service`, `email-service`, `analytic-service`.

#### `seller.updated`

Emitted when seller account status or primary contact properties are modified.

```jsonc
{
  "value": {
    "sellerId": "sel_019a2b3c4d5e",
    "updatedFields": ["status"],
    "updatedAt": "2026-10-22T02:26:00.000Z",
  },
}
```

- **Producer:** `apps/seller-service/src/routes/seller.routes.ts`, `apps/seller-service/src/routes/admin.routes.ts`
- **Consumers:** `notification-service`, `analytic-service`.

#### `seller.suspended`

Emitted when a marketplace seller is suspended for compliance or operational policy violations.

```jsonc
{
  "value": {
    "sellerId": "sel_019a2b3c4d5e",
    "vendorId": "vnd_8492049102",
    "reason": "Repeated order fulfillment delays beyond SLA",
    "suspendedAt": "2026-10-22T02:27:00.000Z",
  },
}
```

- **Producer:** `apps/seller-service/src/routes/admin.routes.ts`, `apps/seller-service/src/routes/seller.routes.ts`
- **Consumers:** `email-service`, `notification-service`, `analytic-service`.

#### `seller.storefront.updated`

Emitted when a seller modifies store branding, tagline, or toggles vacation mode.

```jsonc
{
  "value": {
    "sellerId": "sel_019a2b3c4d5e",
    "storeId": "str_019a2b3c4d5e",
    "storeName": "Apex Gadgets Flagship",
    "slug": "apex-gadgets",
    "vacationMode": false,
    "status": "ACTIVE",
    "updatedAt": "2026-10-22T02:28:00.000Z",
  },
}
```

- **Producer:** `apps/seller-service/src/routes/seller.routes.ts`
- **Consumers:** `notification-service`, `analytic-service`.

## Dead-Letter Queue (DLQ) & Poison-Pill Isolation

In distributed event streams, unhandled consumer crashes or infinite reprocessing loops can stall Kafka partitions. `@repo/kafka` embeds an automatic **Poison-Pill Isolation and Dead-Letter Queue (DLQ)** mechanism in `createConsumer`:

```
Incoming Kafka Message
       │
       ▼
 [JSON.parse] ──(SyntaxError / Malformed)──▶ [Fast-Fail to <topic>.dlq] (Attempt 1)
       │
   Valid JSON
       │
       ▼
[topicHandler] ──(Success)──▶ Commit Offset & Record Metrics
       │
   (Failure)
       │
  Attempts < 3?
     ├── Yes ──▶ Sleep with Exponential Backoff (1s, 2s, 4s) ──▶ Retry topicHandler
     └── No  ──▶ Terminal Failure ──▶ Dispatch to <topic>.dlq ──▶ Commit Offset
```

### Standardized DLQ Headers & Metadata

When a message is dispatched to `<topic>.dlq`, the original payload is wrapped and published with metadata headers:

- `x-original-topic`: Source topic name (e.g. `payment.successful`).
- `x-original-partition`: Partition number where the message was received.
- `x-original-offset`: Source offset.
- `x-consumer-group`: Consumer group ID processing the message.
- `x-error-message`: Extracted error message.
- `x-error-name`: Error constructor name (e.g. `SyntaxError`, `ZodError`).
- `x-error-stack`: Truncated stack trace for auditing.
- `x-attempt-count`: Total number of processing attempts made before isolation.
- `x-is-poison-pill`: `"true"` if fast-failed on malformed payload; `"false"` if failed after retries.
- `x-failed-at`: ISO 8601 timestamp.

### Consumer Retry Configuration

Consumers configure retry and DLQ behavior via `ConsumerRetryOptions`:

```ts
await consumer.consume(topics, handlers, {
  enableDlq: true, // Default: true
  maxRetries: 3, // Default: 3
  initialRetryDelayMs: 1000, // Default: 1000ms
  backoffMultiplier: 2, // Default: 2 (1s, 2s, 4s)
  dlqTopicSuffix: ".dlq", // Default: ".dlq"
});
```

## Adding or changing an event

1. Decide whether the change is additive (new optional field) or breaking (rename,
   type change, removal). Treat anything non-additive as breaking.
2. Update the payload's TypeScript type in `@repo/types` (or the package that owns it).
3. Update the producer.
4. Update **every** consumer and its handler.
5. Update this registry table and the topic's section above.
6. Update the relevant `AGENTS.md`/skill if the convention itself changed.
7. Verify by running the producer and consumer against local Kafka and inspecting the
   topic in Kafka UI at `:8080`.

> Because `fromBeginning: true` is enabled, a changed payload can be replayed into
> consumers as soon as a new group starts. Keep consumers defensive about missing or
> legacy fields.
