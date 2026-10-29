import { services } from "../gateway/service-registry.js";
import type { GatewayRouteConfig } from "@repo/types";

export const publicRoutes: GatewayRouteConfig[] = [
  // 1. Auth Service Public Routes
  {
    prefix: "/api/v1/auth",
    target: services.auth.url,
    serviceName: services.auth.name,
    timeoutMs: services.auth.timeoutMs,
    rewritePrefix: "",
  },

  // 2. Catalog Service (Storefront read-optimized discovery)
  {
    prefix: "/api/v1/catalog",
    target: services.catalog.url,
    serviceName: services.catalog.name,
    timeoutMs: services.catalog.timeoutMs,
    rewritePrefix: "/api/v1/catalog",
  },

  // 3. Product Service Public Discovery
  {
    prefix: "/api/v1/products",
    target: services.product.url,
    serviceName: services.product.name,
    timeoutMs: services.product.timeoutMs,
    rewritePrefix: "/products",
  },
  {
    prefix: "/products",
    target: services.product.url,
    serviceName: services.product.name,
    timeoutMs: services.product.timeoutMs,
    rewritePrefix: "/products",
  },
  {
    prefix: "/api/v1/categories",
    target: services.product.url,
    serviceName: services.product.name,
    timeoutMs: services.product.timeoutMs,
    rewritePrefix: "/categories",
  },
  {
    prefix: "/categories",
    target: services.product.url,
    serviceName: services.product.name,
    timeoutMs: services.product.timeoutMs,
    rewritePrefix: "/categories",
  },

  // 4. Search Service (OpenSearch query API)
  {
    prefix: "/api/v1/search",
    target: services.search.url,
    serviceName: services.search.name,
    timeoutMs: services.search.timeoutMs,
    rewritePrefix: "/api/v1/search",
  },

  // 5. Recommendation Service Public Feeds
  {
    prefix: "/api/v1/recommendations",
    target: services.recommendation.url,
    serviceName: services.recommendation.name,
    timeoutMs: services.recommendation.timeoutMs,
    rewritePrefix: "/api/v1/recommendations",
  },

  // 6. Payment Service Sessions & Webhooks
  {
    prefix: "/api/v1/sessions",
    target: services.payment.url,
    serviceName: services.payment.name,
    timeoutMs: services.payment.timeoutMs,
    rewritePrefix: "/sessions",
  },
  {
    prefix: "/sessions",
    target: services.payment.url,
    serviceName: services.payment.name,
    timeoutMs: services.payment.timeoutMs,
    rewritePrefix: "/sessions",
  },
  {
    prefix: "/api/v1/webhooks",
    target: services.payment.url,
    serviceName: services.payment.name,
    timeoutMs: services.payment.timeoutMs,
    rewritePrefix: "/webhooks",
  },
  {
    prefix: "/webhooks",
    target: services.payment.url,
    serviceName: services.payment.name,
    timeoutMs: services.payment.timeoutMs,
    rewritePrefix: "/webhooks",
  },

  // 7. Notification Service WebSocket Feeds
  {
    prefix: "/ws",
    target: services.notification.url,
    serviceName: services.notification.name,
    timeoutMs: services.notification.timeoutMs,
    rewritePrefix: "/ws",
    websocket: true,
  },

  // 8. Shipping Service Tracking & Rates
  {
    prefix: "/api/v1/tracking",
    target: services.shipping.url,
    serviceName: services.shipping.name,
    timeoutMs: services.shipping.timeoutMs,
    rewritePrefix: "/api/v1/tracking",
  },

  // 9. Media Service Public Read Asset Access
  {
    prefix: "/api/v1/media",
    target: services.media.url,
    serviceName: services.media.name,
    timeoutMs: services.media.timeoutMs,
    rewritePrefix: "/api/v1/media",
  },

  // 10. Review Service Public Product Reviews & Rating Summaries
  {
    prefix: "/api/v1/reviews",
    target: services.review.url,
    serviceName: services.review.name,
    timeoutMs: services.review.timeoutMs,
    rewritePrefix: "/api/v1/reviews",
  },

  // 11. Wishlist Service Shared Wishlists
  {
    prefix: "/api/v1/shared-wishlists",
    target: services.wishlist.url,
    serviceName: services.wishlist.name,
    timeoutMs: services.wishlist.timeoutMs,
    rewritePrefix: "/api/v1/shared-wishlists",
  },

  // 12. Promotion Service Public & Customer Routes (Quotes, Validations, Active, Reservations)
  {
    prefix: "/api/v1/promotions",
    target: services.promotion.url,
    serviceName: services.promotion.name,
    timeoutMs: services.promotion.timeoutMs,
    rewritePrefix: "/api/v1/promotions",
  },

  // 13. Tax Service Public & Checkout Routes (Quotes, Calculates, Returns Quote, Jurisdictions, Categories)
  {
    prefix: "/api/v1/tax",
    target: services.tax.url,
    serviceName: services.tax.name,
    timeoutMs: services.tax.timeoutMs,
    rewritePrefix: "/api/v1/tax",
  },

  // 14. Pricing Service Public & Checkout Routes (Prices, Quotes, Bulk-Quotes)
  {
    prefix: "/api/v1/prices",
    target: services.pricing.url,
    serviceName: services.pricing.name,
    timeoutMs: services.pricing.timeoutMs,
    rewritePrefix: "/api/v1/prices",
  },

  // 15. Seller Service Public Storefront Browsing
  {
    prefix: "/api/v1/storefronts",
    target: services.seller.url,
    serviceName: services.seller.name,
    timeoutMs: services.seller.timeoutMs,
    rewritePrefix: "/api/v1/storefronts",
  },

  // 16. Platform System Settings (Public status query)
  {
    prefix: "/api/v1/system-settings",
    target: services.seller.url,
    serviceName: services.seller.name,
    timeoutMs: services.seller.timeoutMs,
    rewritePrefix: "/api/v1/system-settings",
  },

  // 17. Analytic Service Public Platform Trust & Scale Metrics
  {
    prefix: "/api/v1/analytics/public",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics/public",
  },
  {
    prefix: "/analytics/public",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics/public",
  },
];
