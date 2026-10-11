import { services } from "../gateway/service-registry.js";
import type { GatewayRouteConfig } from "@repo/types";

export const adminRoutes: GatewayRouteConfig[] = [
  // 1. Order Chart & Admin Analytics
  {
    prefix: "/order-chart",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/order-chart",
    requireAdmin: true,
  },
  {
    prefix: "/api/v1/analytics",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics",
    requireAdmin: true,
  },
  {
    prefix: "/analytics",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics",
    requireAdmin: true,
  },

  // 2. Media Service Admin Media Management
  {
    prefix: "/api/v1/admin/media",
    target: services.media.url,
    serviceName: services.media.name,
    timeoutMs: services.media.timeoutMs,
    rewritePrefix: "/api/v1/admin/media",
    requireAdmin: true,
  },
];
