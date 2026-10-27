import type { FastifyPluginAsync } from "fastify";
import { cacheRead, cacheSet } from "@repo/redis";
import {
  type StockAvailabilityCache,
  buildStockCacheKey,
  GATEWAY_HEADERS,
} from "@repo/types";
import { redis } from "../cache/redis.js";
import { services } from "../gateway/service-registry.js";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { singleFlight } from "../resilience/singleflight.js";

async function fetchUpstreamAvailability(
  productId: string,
  variantId?: string,
  requestId?: string,
): Promise<{ availableQuantity: number; status?: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    services.inventory.timeoutMs || 3000,
  );

  const query = variantId ? `?variantId=${encodeURIComponent(variantId)}` : "";
  const url = `${services.inventory.url}/api/v1/inventory/${encodeURIComponent(productId)}/availability${query}`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        [GATEWAY_HEADERS.REQUEST_ID]: requestId || `gw-inv-${Date.now()}`,
        [GATEWAY_HEADERS.INTERNAL_SECRET]: env.INTERNAL_SERVICE_SECRET,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return null;
    }

    const body = (await res.json()) as any;
    const payload = body?.data ?? body;
    return {
      availableQuantity:
        typeof payload?.availableQuantity === "number"
          ? payload.availableQuantity
          : 0,
      status: payload?.status,
    };
  } catch (err) {
    logger.warn("Upstream inventory-service availability query failed", {
      productId,
      error: String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const inventoryEdgeRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * High-velocity edge availability endpoint:
   * Serves directly from Redis in ~1ms to shield inventory-service and PostgreSQL
   * during Daraz Flash Sales. Falls back to inventory-service on cache miss.
   */
  fastify.get(
    "/api/v1/inventory/:productId/availability",
    async (request, reply) => {
      const { productId } = request.params as { productId: string };
      const { variantId } = request.query as { variantId?: string };

      const cacheKey = buildStockCacheKey(productId, variantId);

      // 1. Check Redis edge cache
      try {
        const cached = await cacheRead<StockAvailabilityCache>(
          redis.client,
          cacheKey,
        );

        if (cached.status === "hit" && cached.value) {
          reply.header("X-Cache", "HIT");
          return reply.send({
            data: {
              productId: cached.value.productId,
              variantId: cached.value.variantId,
              availableQuantity: cached.value.availableQuantity,
              status: cached.value.status,
            },
            productId: cached.value.productId,
            variantId: cached.value.variantId,
            availableQuantity: cached.value.availableQuantity,
            status: cached.value.status,
            source: "edge-cache",
          });
        }
      } catch (err) {
        logger.warn("Redis edge cache read error; continuing to upstream", {
          productId,
          error: String(err),
        });
      }

      // 2. Fetch from upstream inventory-service with SingleFlight protection
      const requestId =
        (request.headers[GATEWAY_HEADERS.REQUEST_ID] as string) ||
        String(request.id);
      const flightKey = `inv:${productId}:${variantId ?? ""}`;
      const upstream = await singleFlight.do(
        flightKey,
        () => fetchUpstreamAvailability(productId, variantId, requestId),
        {
          label: "inventory-availability",
          timeoutMs: services.inventory.timeoutMs || 4000,
        },
      );

      if (!upstream) {
        return reply.status(503).send({
          message: "Inventory availability service currently unavailable",
        });
      }

      // 3. Hydrate Redis edge cache (15-minute rolling TTL)
      const availableQty =
        typeof upstream.availableQuantity === "number"
          ? upstream.availableQuantity
          : 0;
      const status =
        upstream.status ||
        (availableQty === 0
          ? "OUT_OF_STOCK"
          : availableQty <= 5
            ? "LOW_STOCK"
            : "IN_STOCK");

      const stockPayload: StockAvailabilityCache = {
        productId: Number(productId) || 0,
        variantId: variantId ?? null,
        availableQuantity: availableQty,
        status: status as "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK",
        updatedAt: new Date().toISOString(),
      };

      await cacheSet(redis.client, cacheKey, stockPayload, 900).catch(() => {});

      reply.header("X-Cache", "MISS");
      return reply.send({
        data: {
          productId: stockPayload.productId,
          variantId: stockPayload.variantId,
          availableQuantity: stockPayload.availableQuantity,
          status: stockPayload.status,
        },
        ...stockPayload,
        source: "inventory-service",
      });
    },
  );
};
