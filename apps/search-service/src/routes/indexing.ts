import type { FastifyPluginAsync } from "fastify";
import { reindexHandler } from "../controllers/indexing.controller.js";
import { shouldBeAdmin } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export const indexingRoutes: FastifyPluginAsync = async (fastify) => {
  // Stricter rate limiting for reindexing operations
  const rateLimiter = createRateLimiter({ windowSeconds: 60, maxRequests: 10 });

  fastify.post(
    "/index/reindex",
    {
      preHandler: [rateLimiter, shouldBeAdmin],
    },
    reindexHandler,
  );
};
