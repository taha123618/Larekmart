import type { FastifyPluginAsync } from "fastify";
import { services } from "../gateway/service-registry.js";
import { logger } from "../observability/logger.js";
import { GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  headers: HeadersInit,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const homeAggregationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/api/v1/home", async (request, reply) => {
    const requestId =
      (request.headers[GATEWAY_HEADERS.REQUEST_ID] as string) ||
      String(request.id);

    const outboundHeaders: Record<string, string> = {
      [GATEWAY_HEADERS.REQUEST_ID]: requestId,
      [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
      "Content-Type": "application/json",
    };

    if (request.headers[GATEWAY_HEADERS.USER_ID]) {
      outboundHeaders[GATEWAY_HEADERS.USER_ID] = request.headers[
        GATEWAY_HEADERS.USER_ID
      ] as string;
    }

    const userId = request.headers[GATEWAY_HEADERS.USER_ID] as
      | string
      | undefined;

    // Concurrent read aggregation with 2.5s bounded timeout to prevent fan-out latency
    const [featuredProductsResult, categoriesResult, recommendationsResult] =
      await Promise.allSettled([
        fetchWithTimeout(
          `${services.catalog.url}/api/v1/catalog/featured`,
          2500,
          outboundHeaders,
        ),
        fetchWithTimeout(
          `${services.catalog.url}/api/v1/catalog/categories`,
          2500,
          outboundHeaders,
        ),
        fetchWithTimeout(
          userId
            ? `${services.recommendation.url}/api/v1/recommendations/personalized?userId=${encodeURIComponent(userId)}`
            : `${services.recommendation.url}/api/v1/recommendations/trending`,
          2000,
          outboundHeaders,
        ),
      ]);

    const featured =
      featuredProductsResult.status === "fulfilled" &&
      featuredProductsResult.value
        ? Array.isArray(featuredProductsResult.value)
          ? featuredProductsResult.value
          : featuredProductsResult.value.items || []
        : [];

    const categories =
      categoriesResult.status === "fulfilled" && categoriesResult.value
        ? Array.isArray(categoriesResult.value)
          ? categoriesResult.value
          : categoriesResult.value.items || []
        : [];

    const recommendations =
      recommendationsResult.status === "fulfilled" &&
      recommendationsResult.value
        ? Array.isArray(recommendationsResult.value)
          ? recommendationsResult.value
          : recommendationsResult.value.items || []
        : [];

    logger.info("Home aggregation served", {
      requestId,
      featuredCount: Array.isArray(featured) ? featured.length : 0,
      categoriesCount: Array.isArray(categories) ? categories.length : 0,
      recommendationsCount: Array.isArray(recommendations)
        ? recommendations.length
        : 0,
    });

    return reply.status(200).send({
      featured,
      categories,
      recommendations,
      timestamp: new Date().toISOString(),
      requestId,
    });
  });
};
