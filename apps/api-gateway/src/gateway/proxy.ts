import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import httpProxy from "@fastify/http-proxy";
import { allGatewayRoutes } from "./route-registry.js";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import {
  requireAdmin,
  requireAuth,
  requireSeller,
} from "../auth/authorization.js";
import { GATEWAY_HEADERS } from "@repo/types";
import { gatewayProxyRequestsTotal } from "../observability/metrics.js";
import { circuitBreaker } from "../resilience/circuit-breaker.js";
import {
  isReadYourWritesActive,
  markReadYourWrites,
  DEFAULT_RYW_TTL_MS,
} from "@repo/redis";
import { redis } from "../utils/redis.js";

export const NON_CRITICAL_SERVICES = new Set<string>([
  "review-service",
  "wishlist-service",
  "recommendation-service",
]);

export async function registerProxyRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  for (const route of allGatewayRoutes) {
    logger.info(`Registering gateway proxy route`, {
      prefix: route.prefix,
      target: route.target,
      service: route.serviceName,
      timeoutMs: route.timeoutMs,
      rewritePrefix: route.rewritePrefix,
      websocket: route.websocket,
    });

    const preHandler = (
      req: FastifyRequest,
      reply: FastifyReply,
      done: (err?: Error) => void,
    ) => {
      const run = async () => {
        // Fast-fail or degrade if downstream circuit breaker is open
        if (!circuitBreaker.isAvailable(route.serviceName)) {
          if (
            NON_CRITICAL_SERVICES.has(route.serviceName) &&
            req.method === "GET"
          ) {
            reply.status(200).send({
              data: [],
              degraded: true,
              message: `${route.serviceName} is temporarily degraded. Serving fallback content.`,
            });
            return;
          }
          reply
            .header("Retry-After", "5")
            .status(503)
            .send({
              statusCode: 503,
              error: "Service Unavailable",
              message: `${route.serviceName} is temporarily unavailable, please retry.`,
              degraded: false,
              retryAfter: 5,
            });
          return;
        }

        if (route.requireAdmin) {
          await requireAdmin(req, reply);
        } else if (route.requireSeller) {
          await requireSeller(req, reply);
        } else if (route.requireAuth) {
          await requireAuth(req, reply);
        }

        // Check for active Read-Your-Writes consistency lease
        const rywClientId =
          req.authUserId ||
          (req.headers[GATEWAY_HEADERS.CLIENT_SESSION_ID] as string) ||
          (req.headers[GATEWAY_HEADERS.GUEST_TOKEN] as string) ||
          req.ip;
        if (rywClientId) {
          try {
            const isRyw = await isReadYourWritesActive(
              redis.client,
              rywClientId,
            );
            if (isRyw) {
              (
                req as FastifyRequest & { _readYourWritesActive?: boolean }
              )._readYourWritesActive = true;
            }
          } catch {
            // Non-blocking degradation
          }
        }
      };

      run()
        .then(() => {
          if (!reply.sent) {
            done();
          }
        })
        .catch((err) =>
          done(err instanceof Error ? err : new Error(String(err))),
        );
    };

    await fastify.register(httpProxy, {
      upstream: route.target,
      prefix: route.prefix,
      rewritePrefix: route.rewritePrefix,
      http2: false,
      websocket: route.websocket ?? false,
      preHandler: preHandler as any,
      replyOptions: {
        onError: (reply, { error }) => {
          const startMs: number =
            (reply.request as FastifyRequest & { _proxyStartMs?: number })
              ._proxyStartMs ?? Date.now();
          const latencyMs = Date.now() - startMs;
          circuitBreaker.recordFailure(route.serviceName, latencyMs);
          logger.warn(
            `Gateway proxy error for service ${route.serviceName}: ${error.message}`,
          );
          if (!reply.sent) {
            const req = reply.request as FastifyRequest | undefined;
            if (
              NON_CRITICAL_SERVICES.has(route.serviceName) &&
              req?.method === "GET"
            ) {
              reply.status(200).send({
                data: [],
                degraded: true,
                message: `${route.serviceName} is temporarily unavailable. Serving fallback content.`,
              });
            } else {
              reply
                .header("Retry-After", "5")
                .status(503)
                .send({
                  statusCode: 503,
                  error: "Service Unavailable",
                  message: `${route.serviceName} is temporarily unavailable, please retry.`,
                  degraded: false,
                  retryAfter: 5,
                });
            }
          }
        },
        onResponse: (request, _reply, res) => {
          const startMs: number =
            (request as FastifyRequest & { _proxyStartMs?: number })
              ._proxyStartMs ?? Date.now();
          const latencyMs = Date.now() - startMs;
          const status = res.statusCode ?? 200;

          // Parse upstream Retry-After on 429 / 503 for health feedback
          if (status === 429 || status === 503) {
            const retryAfterHeader = (
              res as { headers?: Record<string, string | string[] | undefined> }
            ).headers?.["retry-after"];
            const retryAfterSecs = retryAfterHeader
              ? parseInt(
                  Array.isArray(retryAfterHeader)
                    ? (retryAfterHeader[0] ?? "0")
                    : retryAfterHeader,
                  10,
                )
              : 0;
            if (retryAfterSecs > 0) {
              circuitBreaker.feedUpstreamRetryAfter(
                route.serviceName,
                retryAfterSecs,
              );
            }
          }

          if (status >= 500) {
            circuitBreaker.recordFailure(route.serviceName, latencyMs);
          } else {
            circuitBreaker.recordSuccess(route.serviceName, latencyMs);
          }

          // If this was a successful state-mutating request (POST, PUT, PATCH, DELETE),
          // register a temporary Read-Your-Writes consistency lease in Redis (500ms TTL)
          // so subsequent edge/storefront reads from this client query the primary master pool.
          if (
            (request.method === "POST" ||
              request.method === "PUT" ||
              request.method === "PATCH" ||
              request.method === "DELETE") &&
            status >= 200 &&
            status < 300
          ) {
            const rywClientId =
              request.authUserId ||
              (request.headers[GATEWAY_HEADERS.CLIENT_SESSION_ID] as string) ||
              (request.headers[GATEWAY_HEADERS.GUEST_TOKEN] as string) ||
              request.ip;
            if (rywClientId) {
              markReadYourWrites(redis.client, rywClientId, {
                ttlMs: DEFAULT_RYW_TTL_MS,
              }).catch((err) => {
                logger.warn("Failed to mark Read-Your-Writes lease in Redis", {
                  clientId: rywClientId,
                  error: String(err),
                });
              });
            }
          }
        },
        rewriteRequestHeaders: (originalReq, headers) => {
          // Stamp the wall-clock start time so onError/onResponse can compute latency
          (
            originalReq as FastifyRequest & { _proxyStartMs?: number }
          )._proxyStartMs = Date.now();

          gatewayProxyRequestsTotal.inc({
            service: String(route.serviceName),
            method: originalReq.method,
          });

          const rewritten: Record<string, string | string[] | undefined> = {
            ...headers,
            [GATEWAY_HEADERS.REQUEST_ID]:
              (originalReq.headers[GATEWAY_HEADERS.REQUEST_ID] as string) ||
              String(originalReq.id),
          };

          // Explicitly strip untrusted client-supplied identity & internal headers
          delete rewritten[GATEWAY_HEADERS.USER_ID];
          delete rewritten[GATEWAY_HEADERS.USER_ROLE];
          delete rewritten[GATEWAY_HEADERS.IS_SUPER_ADMIN];
          delete rewritten[GATEWAY_HEADERS.IS_SELLER];
          delete rewritten[GATEWAY_HEADERS.CAN_MANAGE_SELLERS];
          delete rewritten[GATEWAY_HEADERS.FORCE_PRIMARY];
          delete rewritten[GATEWAY_HEADERS.READ_YOUR_WRITES];
          delete rewritten["x-user-id"];
          delete rewritten["x-user-role"];
          delete rewritten["x-user-is-super-admin"];
          delete rewritten["x-user-is-seller"];
          delete rewritten["x-user-can-manage-sellers"];
          delete rewritten["x-internal-secret"];
          delete rewritten["x-user-permissions"];
          delete rewritten["x-force-primary"];
          delete rewritten["x-read-your-writes"];

          // If client has an active Read-Your-Writes lease, force downstream queries to primary master
          if (
            (
              originalReq as FastifyRequest & {
                _readYourWritesActive?: boolean;
              }
            )._readYourWritesActive
          ) {
            rewritten[GATEWAY_HEADERS.FORCE_PRIMARY] = "true";
            rewritten[GATEWAY_HEADERS.READ_YOUR_WRITES] = "true";
          }

          // Inject verified internal gateway secret for downstream services
          rewritten[GATEWAY_HEADERS.INTERNAL_SECRET] =
            env.INTERNAL_SERVICE_SECRET;

          // Forward W3C traceparent if present
          if (originalReq.headers["traceparent"]) {
            rewritten["traceparent"] = originalReq.headers["traceparent"];
          }

          // Inject user identity ONLY if authenticated by verified Clerk claims
          if (originalReq.authUserId) {
            rewritten[GATEWAY_HEADERS.USER_ID] = originalReq.authUserId;
            rewritten[GATEWAY_HEADERS.USER_ROLE] =
              originalReq.userRole || "user";
            if (originalReq.isSuperAdmin) {
              rewritten[GATEWAY_HEADERS.IS_SUPER_ADMIN] = "true";
            }
            if (originalReq.isSeller) {
              rewritten[GATEWAY_HEADERS.IS_SELLER] = "true";
            }
            if (originalReq.canManageSellers) {
              rewritten[GATEWAY_HEADERS.CAN_MANAGE_SELLERS] = "true";
            }
          }

          return rewritten;
        },
      },
    });
  }
}
