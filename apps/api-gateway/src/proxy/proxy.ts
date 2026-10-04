import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import httpProxy from "@fastify/http-proxy";
import { apiRoutes } from "../config/routes.js";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import {
  requireAdmin,
  requireAuth,
  requireSeller,
} from "../middleware/auth.js";

export async function registerProxyRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  for (const route of apiRoutes) {
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
          const rewritten: Record<string, string | string[] | undefined> = {
            ...headers,
            "x-request-id":
              (originalReq.headers["x-request-id"] as string) ||
              String(originalReq.id),
            "x-internal-secret": env.INTERNAL_SERVICE_SECRET,
          };

          if (originalReq.headers["x-user-id"]) {
            rewritten["x-user-id"] = originalReq.headers["x-user-id"] as string;
          }
          if (originalReq.headers["x-user-role"]) {
            rewritten["x-user-role"] = originalReq.headers["x-user-role"] as string;
          }

          return rewritten;
        },
      },
    });
  }
}
