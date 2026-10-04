import { z } from "zod";

export const GatewayErrorCode = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "RATE_LIMITED",
  "REQUEST_TIMEOUT",
  "SERVICE_UNAVAILABLE",
  "BAD_GATEWAY",
  "GATEWAY_TIMEOUT",
  "INTERNAL_SERVER_ERROR",
]);

export type GatewayErrorCode = z.infer<typeof GatewayErrorCode>;

export const GatewayErrorPayloadSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
  code: GatewayErrorCode.optional(),
  requestId: z.string().optional(),
  timestamp: z.string().optional(),
});

export type GatewayErrorPayload = z.infer<typeof GatewayErrorPayloadSchema>;
