import type { FastifyPluginAsync } from "fastify";
import { searchProductsHandler } from "../controllers/search.controller.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export const searchRoutes: FastifyPluginAsync = async (fastify) => {
  const rateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 120,
  });

  fastify.get(
    "/search",
    {
      preHandler: [rateLimiter],
    },
    searchProductsHandler,
  );
};
