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
            .catch((err) => done(err instanceof Error ? err : new Error(String(err))));
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

          // Forward W3C traceparent if present
          if (originalReq.headers["traceparent"]) {
            rewritten["traceparent"] = originalReq.headers["traceparent"];
          }

          if (originalReq.headers[GATEWAY_HEADERS.USER_ID]) {
            rewritten[GATEWAY_HEADERS.USER_ID] = originalReq.headers[
              GATEWAY_HEADERS.USER_ID
            ] as string;
          }
          if (originalReq.headers[GATEWAY_HEADERS.USER_ROLE]) {
            rewritten[GATEWAY_HEADERS.USER_ROLE] = originalReq.headers[
              GATEWAY_HEADERS.USER_ROLE
            ] as string;
          }

          return rewritten;
        },
      },
    });
  }
}
