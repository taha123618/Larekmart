import type { FastifyPluginAsync } from "fastify";
import { getSuggestionsHandler } from "../controllers/suggestions.controller.js";
import { createRateLimiter } from "../middleware/rate-limit.js";

export const suggestionRoutes: FastifyPluginAsync = async (fastify) => {
  const rateLimiter = createRateLimiter({
    windowSeconds: 60,
    maxRequests: 240,
  });

  fastify.get(
    "/search/suggestions",
    {
      preHandler: [rateLimiter],
    },
    getSuggestionsHandler,
  );
};
