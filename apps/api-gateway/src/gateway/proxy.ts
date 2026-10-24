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

    const hasAuthCheck = Boolean(
      route.requireAdmin || route.requireSeller || route.requireAuth,
    );

    const preHandler = hasAuthCheck
      ? (
          req: FastifyRequest,
          reply: FastifyReply,
          done: (err?: Error) => void,
        ) => {
          const run = async () => {
            if (route.requireAdmin) {
              await requireAdmin(req, reply);
            } else if (route.requireSeller) {
              await requireSeller(req, reply);
            } else if (route.requireAuth) {
              await requireAuth(req, reply);
            }
          };

          run()
            .then(() => done())
            .catch((err) =>
              done(err instanceof Error ? err : new Error(String(err))),
            );
        }
      : undefined;

    await fastify.register(httpProxy, {
      upstream: route.target,
      prefix: route.prefix,
      rewritePrefix: route.rewritePrefix,
      http2: false,
      websocket: route.websocket ?? false,
      preHandler: preHandler as any,
      replyOptions: {
        rewriteRequestHeaders: (originalReq, headers) => {
          gatewayProxyRequestsTotal.inc({
            service: String(route.serviceName),
            method: originalReq.method,
          });

          const rewritten: Record<string, string | string[] | undefined> = {
            ...headers,
            [GATEWAY_HEADERS.REQUEST_ID]:
              (originalReq.headers[GATEWAY_HEADERS.REQUEST_ID] as string) ||
              String(originalReq.id),
            [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
          };

          // Explicitly strip untrusted client-supplied identity & internal headers
          delete rewritten[GATEWAY_HEADERS.USER_ID];
          delete rewritten[GATEWAY_HEADERS.USER_ROLE];
          delete rewritten[GATEWAY_HEADERS.IS_SUPER_ADMIN];
          delete rewritten[GATEWAY_HEADERS.IS_SELLER];
          delete rewritten[GATEWAY_HEADERS.CAN_MANAGE_SELLERS];
          delete rewritten["x-user-id"];
          delete rewritten["x-user-role"];
          delete rewritten["x-user-is-super-admin"];
          delete rewritten["x-user-is-seller"];
          delete rewritten["x-user-can-manage-sellers"];
          delete rewritten["x-internal-secret"];
          delete rewritten["x-user-permissions"];

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
