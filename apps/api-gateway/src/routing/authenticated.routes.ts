import { services } from "../gateway/service-registry.js";
import type { GatewayRouteConfig } from "@repo/types";

export const authenticatedRoutes: GatewayRouteConfig[] = [
  // 1. User Service
  {
    prefix: "/api/v1/users",
    target: services.user.url,
    serviceName: services.user.name,
    timeoutMs: services.user.timeoutMs,
    rewritePrefix: "/api/v1/users",
  },
  {
    prefix: "/users",
    target: services.auth.url,
    serviceName: services.auth.name,
    timeoutMs: services.auth.timeoutMs,
    rewritePrefix: "/users",
  },

  // 2. Cart Service
  {
    prefix: "/api/v1/cart",
    target: services.cart.url,
    serviceName: services.cart.name,
    timeoutMs: services.cart.timeoutMs,
    rewritePrefix: "/api/v1/cart",
  },

  // 3. Order Service
  {
    prefix: "/api/v1/orders",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/orders",
  },
  {
    prefix: "/orders",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/orders",
  },
  {
    prefix: "/api/v1/user-orders",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/user-orders",
    requireAuth: true,
  },
  {
    prefix: "/user-orders",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/user-orders",
    requireAuth: true,
  },

  // 4. Payment Service Authenticated Routes
  {
    prefix: "/api/v1/payments",
    target: services.payment.url,
    serviceName: services.payment.name,
    timeoutMs: services.payment.timeoutMs,
    rewritePrefix: "",
  },

  // 5. Inventory Service
  {
    prefix: "/api/v1/inventory",
    target: services.inventory.url,
    serviceName: services.inventory.name,
    timeoutMs: services.inventory.timeoutMs,
    rewritePrefix: "/api/v1/inventory",
  },

  // 6. Shipping Service
  {
    prefix: "/api/v1/shipping",
    target: services.shipping.url,
    serviceName: services.shipping.name,
    timeoutMs: services.shipping.timeoutMs,
    rewritePrefix: "/api/v1/shipping",
  },
  {
    prefix: "/api/v1/shipments",
    target: services.shipping.url,
    serviceName: services.shipping.name,
    timeoutMs: services.shipping.timeoutMs,
    rewritePrefix: "/api/v1/shipments",
  },

  // 7. Recommendation Interactions Tracking
  {
    prefix: "/api/v1/interactions",
    target: services.recommendation.url,
    serviceName: services.recommendation.name,
    timeoutMs: services.recommendation.timeoutMs,
    rewritePrefix: "/api/v1/interactions",
  },

  // 8. Notifications Service
  {
    prefix: "/api/v1/notifications",
    target: services.notification.url,
    serviceName: services.notification.name,
    timeoutMs: services.notification.timeoutMs,
    rewritePrefix: "/notifications",
    websocket: true,
  },
  {
    prefix: "/notifications",
    target: services.notification.url,
    serviceName: services.notification.name,
    timeoutMs: services.notification.timeoutMs,
    rewritePrefix: "/notifications",
    websocket: true,
  },

  // 9. Customer Personal Reviews
  {
    prefix: "/api/v1/me/reviews",
    target: services.review.url,
    serviceName: services.review.name,
    timeoutMs: services.review.timeoutMs,
    rewritePrefix: "/api/v1/me/reviews",
    requireAuth: true,
  },

  // 10. Customer Wishlists
  {
    prefix: "/api/v1/me/wishlists",
    target: services.wishlist.url,
    serviceName: services.wishlist.name,
    timeoutMs: services.wishlist.timeoutMs,
    rewritePrefix: "/api/v1/me/wishlists",
  },
];
