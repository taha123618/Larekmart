import z from "zod";

/**
 * Standard HTTP headers injected or propagated by the API Gateway across microservices.
 */
export const GATEWAY_HEADERS = {
  REQUEST_ID: "x-request-id",
  INTERNAL_SECRET: "x-internal-secret",
  USER_ID: "x-user-id",
  USER_ROLE: "x-user-role",
  IS_SUPER_ADMIN: "x-user-is-super-admin",
  IS_SELLER: "x-user-is-seller",
  CAN_MANAGE_SELLERS: "x-user-can-manage-sellers",
  GUEST_TOKEN: "x-guest-token",
  FORWARDED_FOR: "x-forwarded-for",
  IDEMPOTENCY_KEY: "idempotency-key",
} as const;

export type GatewayHeaderKey =
  (typeof GATEWAY_HEADERS)[keyof typeof GATEWAY_HEADERS];

/**
 * Known insecure development placeholder values for internal service secrets.
 * These placeholders must NEVER be accepted when NODE_ENV is "production".
 */
export const DEFAULT_INTERNAL_SECRET = "dev-shared-internal-secret-larekmart";
export const INSECURE_INTERNAL_SECRET_PLACEHOLDERS = [
  DEFAULT_INTERNAL_SECRET,
  "dev-internal-secret-change-in-production",
  "dev_gateway_secret_change_in_production",
  "internal_secret_key_abc",
  "secret",
  "change-me",
] as const;

/**
 * Validates that an internal service secret satisfies production fail-closed security invariants:
 * 1. Must be defined and non-empty.
 * 2. Must not match any known development placeholder.
 * 3. Must be at least 16 characters in length.
 *
 * If NODE_ENV is "production" and any condition fails, this function throws a fatal Error.
 */
export function validateInternalServiceSecret(
  secret?: string | null,
  nodeEnv: string = process.env.NODE_ENV || "development",
  serviceName: string = "service",
): void {
  if (nodeEnv === "production") {
    if (
      !secret ||
      INSECURE_INTERNAL_SECRET_PLACEHOLDERS.includes(secret as any) ||
      secret.trim().length < 16
    ) {
      throw new Error(
        `[${serviceName}] FATAL: In production, INTERNAL_SERVICE_SECRET must be configured with a cryptographically secure random secret (minimum 16 characters) and cannot use development default placeholders.`,
      );
    }
  }
}

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

export type GatewayHealthResponse = z.infer<typeof GatewayHealthResponseSchema>;

/**
 * Standard Gateway Structured Error Response schema.
 */
export const GatewayErrorResponseSchema = z.object({
  message: z.string(),
  statusCode: z.number().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
});

export type GatewayErrorResponse = z.infer<typeof GatewayErrorResponseSchema>;

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
