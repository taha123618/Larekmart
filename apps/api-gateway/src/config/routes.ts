import { downstreamServices } from "./services.js";

export interface RouteMapping {
  prefix: string;
  target: string;
  serviceName: string;
  timeoutMs: number;
  rewritePrefix?: string;
  websocket?: boolean;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireSeller?: boolean;
}

export const apiRoutes: RouteMapping[] = [
  // 1. Auth Service
  {
    prefix: "/api/v1/auth",
    target: downstreamServices.auth.url,
    serviceName: downstreamServices.auth.name,
    timeoutMs: downstreamServices.auth.timeoutMs,
    rewritePrefix: "",
  },
  {
    prefix: "/users",
    target: downstreamServices.auth.url,
    serviceName: downstreamServices.auth.name,
    timeoutMs: downstreamServices.auth.timeoutMs,
    rewritePrefix: "/users",
  },

  // 2. User Service
  {
    prefix: "/api/v1/users",
    target: downstreamServices.user.url,
    serviceName: downstreamServices.user.name,
    timeoutMs: downstreamServices.user.timeoutMs,
    rewritePrefix: "/api/v1/users",
  },

  // 3. Catalog Service (Storefront read-optimized product discovery)
  {
    prefix: "/api/v1/catalog",
    target: downstreamServices.catalog.url,
    serviceName: downstreamServices.catalog.name,
    timeoutMs: downstreamServices.catalog.timeoutMs,
    rewritePrefix: "/api/v1/catalog",
  },

  // 4. Product Service (Admin & Authoritative Product Management)
  {
    prefix: "/api/v1/products",
    target: downstreamServices.product.url,
    serviceName: downstreamServices.product.name,
    timeoutMs: downstreamServices.product.timeoutMs,
    rewritePrefix: "/products",
  },
  {
    prefix: "/products",
    target: downstreamServices.product.url,
    serviceName: downstreamServices.product.name,
    timeoutMs: downstreamServices.product.timeoutMs,
    rewritePrefix: "/products",
  },
  {
    prefix: "/api/v1/categories",
    target: downstreamServices.product.url,
    serviceName: downstreamServices.product.name,
    timeoutMs: downstreamServices.product.timeoutMs,
    rewritePrefix: "/categories",
  },
  {
    prefix: "/categories",
    target: downstreamServices.product.url,
    serviceName: downstreamServices.product.name,
    timeoutMs: downstreamServices.product.timeoutMs,
    rewritePrefix: "/categories",
  },

  // 5. Inventory Service
  {
    prefix: "/api/v1/inventory",
    target: downstreamServices.inventory.url,
    serviceName: downstreamServices.inventory.name,
    timeoutMs: downstreamServices.inventory.timeoutMs,
    rewritePrefix: "/api/v1/inventory",
  },

  // 6. Cart Service
  {
    prefix: "/api/v1/cart",
    target: downstreamServices.cart.url,
    serviceName: downstreamServices.cart.name,
    timeoutMs: downstreamServices.cart.timeoutMs,
    rewritePrefix: "/api/v1/cart",
  },

  // 7. Order Service
  {
    prefix: "/api/v1/orders",
    target: downstreamServices.order.url,
    serviceName: downstreamServices.order.name,
    timeoutMs: downstreamServices.order.timeoutMs,
    rewritePrefix: "/orders",
  },
  {
    prefix: "/orders",
    target: downstreamServices.order.url,
    serviceName: downstreamServices.order.name,
    timeoutMs: downstreamServices.order.timeoutMs,
    rewritePrefix: "/orders",
  },
  {
    prefix: "/api/v1/user-orders",
    target: downstreamServices.order.url,
    serviceName: downstreamServices.order.name,
    timeoutMs: downstreamServices.order.timeoutMs,
    rewritePrefix: "/user-orders",
    requireAuth: true,
  },
  {
    prefix: "/user-orders",
    target: downstreamServices.order.url,
    serviceName: downstreamServices.order.name,
    timeoutMs: downstreamServices.order.timeoutMs,
    rewritePrefix: "/user-orders",
    requireAuth: true,
  },
  {
    prefix: "/order-chart",
    target: downstreamServices.order.url,
    serviceName: downstreamServices.order.name,
    timeoutMs: downstreamServices.order.timeoutMs,
    rewritePrefix: "/order-chart",
    requireAdmin: true,
  },

  // 8. Payment Service
  {
    prefix: "/api/v1/payments",
    target: downstreamServices.payment.url,
    serviceName: downstreamServices.payment.name,
    timeoutMs: downstreamServices.payment.timeoutMs,
    rewritePrefix: "",
  },
  {
    prefix: "/sessions",
    target: downstreamServices.payment.url,
    serviceName: downstreamServices.payment.name,
    timeoutMs: downstreamServices.payment.timeoutMs,
    rewritePrefix: "/sessions",
  },
  {
    prefix: "/webhooks",
    target: downstreamServices.payment.url,
    serviceName: downstreamServices.payment.name,
    timeoutMs: downstreamServices.payment.timeoutMs,
    rewritePrefix: "/webhooks",
  },

  // 9. Shipping Service
  {
    prefix: "/api/v1/shipping",
    target: downstreamServices.shipping.url,
    serviceName: downstreamServices.shipping.name,
    timeoutMs: downstreamServices.shipping.timeoutMs,
    rewritePrefix: "/api/v1/shipping",
  },
  {
    prefix: "/api/v1/shipments",
    target: downstreamServices.shipping.url,
    serviceName: downstreamServices.shipping.name,
    timeoutMs: downstreamServices.shipping.timeoutMs,
    rewritePrefix: "/api/v1/shipments",
  },
  {
    prefix: "/api/v1/tracking",
    target: downstreamServices.shipping.url,
    serviceName: downstreamServices.shipping.name,
    timeoutMs: downstreamServices.shipping.timeoutMs,
    rewritePrefix: "/api/v1/tracking",
  },

  // 10. Analytic Service
  {
    prefix: "/api/v1/analytics",
    target: downstreamServices.analytic.url,
    serviceName: downstreamServices.analytic.name,
    timeoutMs: downstreamServices.analytic.timeoutMs,
    rewritePrefix: "/analytics",
  },
  {
    prefix: "/analytics",
    target: downstreamServices.analytic.url,
    serviceName: downstreamServices.analytic.name,
    timeoutMs: downstreamServices.analytic.timeoutMs,
    rewritePrefix: "/analytics",
  },

  // 11. Notification Service
  {
    prefix: "/api/v1/notifications",
    target: downstreamServices.notification.url,
    serviceName: downstreamServices.notification.name,
    timeoutMs: downstreamServices.notification.timeoutMs,
    rewritePrefix: "/notifications",
    websocket: true,
  },
  {
    prefix: "/notifications",
    target: downstreamServices.notification.url,
    serviceName: downstreamServices.notification.name,
    timeoutMs: downstreamServices.notification.timeoutMs,
    rewritePrefix: "/notifications",
    websocket: true,
  },
  {
    prefix: "/ws",
    target: downstreamServices.notification.url,
    serviceName: downstreamServices.notification.name,
    timeoutMs: downstreamServices.notification.timeoutMs,
    rewritePrefix: "/ws",
    websocket: true,
  },

  // 12. Search Service (OpenSearch query API)
  {
    prefix: "/api/v1/search",
    target: downstreamServices.search.url,
    serviceName: downstreamServices.search.name,
    timeoutMs: downstreamServices.search.timeoutMs,
    rewritePrefix: "/api/v1/search",
  },

  // 13. Recommendation Service
  {
    prefix: "/api/v1/recommendations",
    target: downstreamServices.recommendation.url,
    serviceName: downstreamServices.recommendation.name,
    timeoutMs: downstreamServices.recommendation.timeoutMs,
    rewritePrefix: "/api/v1/recommendations",
  },
  {
    prefix: "/api/v1/interactions",
    target: downstreamServices.recommendation.url,
    serviceName: downstreamServices.recommendation.name,
    timeoutMs: downstreamServices.recommendation.timeoutMs,
    rewritePrefix: "/api/v1/interactions",
  },

  // 14. Media Service
  {
    prefix: "/api/v1/media",
    target: downstreamServices.media.url,
    serviceName: downstreamServices.media.name,
    timeoutMs: downstreamServices.media.timeoutMs,
    rewritePrefix: "/api/v1/media",
  },
  {
    prefix: "/api/v1/admin/media",
    target: downstreamServices.media.url,
    serviceName: downstreamServices.media.name,
    timeoutMs: downstreamServices.media.timeoutMs,
    rewritePrefix: "/api/v1/admin",
  },
];
