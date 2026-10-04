import { env } from "./env.js";

export interface ServiceTarget {
  name: string;
  url: string;
  timeoutMs: number;
}

export const downstreamServices = {
  auth: {
    name: "auth-service",
    url: env.AUTH_SERVICE_URL,
    timeoutMs: 5000,
  },
  user: {
    name: "user-service",
    url: env.USER_SERVICE_URL,
    timeoutMs: 5000,
  },
  catalog: {
    name: "catalog-service",
    url: env.CATALOG_SERVICE_URL,
    timeoutMs: 5000,
  },
  product: {
    name: "product-service",
    url: env.PRODUCT_SERVICE_URL,
    timeoutMs: 5000,
  },
  inventory: {
    name: "inventory-service",
    url: env.INVENTORY_SERVICE_URL,
    timeoutMs: 5000,
  },
  cart: {
    name: "cart-service",
    url: env.CART_SERVICE_URL,
    timeoutMs: 5000,
  },
  order: {
    name: "order-service",
    url: env.ORDER_SERVICE_URL,
    timeoutMs: 10000,
  },
  payment: {
    name: "payment-service",
    url: env.PAYMENT_SERVICE_URL,
    timeoutMs: 15000,
  },
  shipping: {
    name: "shipping-service",
    url: env.SHIPPING_SERVICE_URL,
    timeoutMs: 10000,
  },
  analytic: {
    name: "analytic-service",
    url: env.ANALYTIC_SERVICE_URL,
    timeoutMs: 5000,
  },
  notification: {
    name: "notification-service",
    url: env.NOTIFICATION_SERVICE_URL,
    timeoutMs: 5000,
  },
  search: {
    name: "search-service",
    url: env.SEARCH_SERVICE_URL,
    timeoutMs: 3000,
  },
  recommendation: {
    name: "recommendation-service",
    url: env.RECOMMENDATION_SERVICE_URL,
    timeoutMs: 6000,
  },
  media: {
    name: "media-service",
    url: env.MEDIA_SERVICE_URL,
    timeoutMs: 15000,
  },
} as const satisfies Record<string, ServiceTarget>;
