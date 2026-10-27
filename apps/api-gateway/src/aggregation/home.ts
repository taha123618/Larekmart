import type { FastifyPluginAsync } from "fastify";
import { services } from "../gateway/service-registry.js";
import { logger } from "../observability/logger.js";
import { GATEWAY_HEADERS } from "@repo/types";
import { env } from "../config/env.js";
import { singleFlight } from "../resilience/singleflight.js";

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

    const userId = request.authUserId;
    if (userId) {
      outboundHeaders[GATEWAY_HEADERS.USER_ID] = userId;
      if (request.userRole) {
        outboundHeaders[GATEWAY_HEADERS.USER_ROLE] = request.userRole;
      }
    }

    // Concurrent read aggregation with SingleFlight coalescing to prevent fan-out storms
    const [featuredProductsResult, categoriesResult, recommendationsResult] =
      await Promise.allSettled([
        singleFlight.do(
          "home:catalog:featured",
          () =>
            fetchWithTimeout(
              `${services.catalog.url}/api/v1/catalog/featured`,
              2500,
              outboundHeaders,
            ),
          { label: "home-featured", timeoutMs: 3000 },
        ),
        singleFlight.do(
          "home:catalog:categories",
          () =>
            fetchWithTimeout(
              `${services.catalog.url}/api/v1/catalog/categories`,
              2500,
              outboundHeaders,
            ),
          { label: "home-categories", timeoutMs: 3000 },
        ),
        userId
          ? fetchWithTimeout(
              `${services.recommendation.url}/api/v1/recommendations/personalized?userId=${encodeURIComponent(userId)}`,
              2000,
              outboundHeaders,
            )
          : singleFlight.do(
              "home:recommendations:trending",
              () =>
                fetchWithTimeout(
                  `${services.recommendation.url}/api/v1/recommendations/trending`,
                  2000,
                  outboundHeaders,
                ),
              { label: "home-trending-recommendations", timeoutMs: 2500 },
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
