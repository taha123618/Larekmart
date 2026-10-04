import z from "zod";

/**
 * Standard HTTP headers injected or propagated by the API Gateway across microservices.
 */
export const GATEWAY_HEADERS = {
  REQUEST_ID: "x-request-id",
  INTERNAL_SECRET: "x-internal-secret",
  USER_ID: "x-user-id",
  USER_ROLE: "x-user-role",
  GUEST_TOKEN: "x-guest-token",
  FORWARDED_FOR: "x-forwarded-for",
  IDEMPOTENCY_KEY: "idempotency-key",
} as const;

export type GatewayHeaderKey =
  (typeof GATEWAY_HEADERS)[keyof typeof GATEWAY_HEADERS];

/**
 * Validated downstream microservices registered in the API Gateway.
 */
export const DOWNSTREAM_SERVICES = [
  "auth-service",
  "user-service",
  "catalog-service",
  "product-service",
  "inventory-service",
  "cart-service",
  "order-service",
  "payment-service",
  "shipping-service",
  "analytic-service",
  "notification-service",
  "search-service",
  "recommendation-service",
  "media-service",
] as const;

export type DownstreamServiceName = (typeof DOWNSTREAM_SERVICES)[number];

/**
 * Unified API Gateway route definition structure.
 */
export interface GatewayRouteConfig {
  prefix: string;
  target: string;
  serviceName: DownstreamServiceName | string;
  timeoutMs: number;
  rewritePrefix?: string;
  websocket?: boolean;
  requireAuth?: boolean;
  requireAdmin?: boolean;
  requireSeller?: boolean;
}

/**
 * Standard Gateway Health Check Response schema.
 */
export const GatewayHealthResponseSchema = z.object({
  status: z.enum(["ok", "ready", "unhealthy"]),
  service: z.literal("api-gateway"),
  timestamp: z.string(),
});

export type GatewayHealthResponse = z.infer<
  typeof GatewayHealthResponseSchema
>;

/**
 * Standard Gateway Structured Error Response schema.
 */
export const GatewayErrorResponseSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
});

export type GatewayErrorResponse = z.infer<
  typeof GatewayErrorResponseSchema
>;

/**
 * Gateway Home Aggregation Response schema.
 */
export const GatewayHomeAggregationResponseSchema = z.object({
  featured: z.array(z.any()),
  categories: z.array(z.any()),
  recommendations: z.any(),
  timestamp: z.string(),
  requestId: z.string(),
});

export type GatewayHomeAggregationResponse = z.infer<
  typeof GatewayHomeAggregationResponseSchema
>;

