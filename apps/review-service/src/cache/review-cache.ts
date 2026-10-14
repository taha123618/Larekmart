import { cacheRead, cacheSet, cacheDel } from "@repo/redis";
import { redis } from "../utils/redis.js";
import type { ProductRatingSummary } from "@repo/types";

const SUMMARY_TTL_SECONDS = 3600; // 1 hour

export class ReviewCache {
  private getSummaryKey(productId: string): string {
    return `summary:${productId}`;
  }

  async getSummary(productId: string): Promise<ProductRatingSummary | null> {
    try {
      const key = this.getSummaryKey(productId);
      const res = await cacheRead<ProductRatingSummary>(redis.client, key);
      if (res.status === "hit" && res.value) {
        return res.value;
      }
      return null;
    } catch (err) {
      console.warn("Failed to read rating summary from cache:", err);
      return null;
    }
  }

  async setSummary(
    productId: string,
    summary: ProductRatingSummary,
    ttl = SUMMARY_TTL_SECONDS,
  ): Promise<void> {
    try {
      const key = this.getSummaryKey(productId);
      await cacheSet(redis.client, key, summary, ttl);
    } catch (err) {
      console.warn("Failed to set rating summary in cache:", err);
    }
  }

  async invalidateSummary(productId: string): Promise<void> {
    try {
      const key = this.getSummaryKey(productId);
      await cacheDel(redis.client, key);
    } catch (err) {
      console.warn("Failed to invalidate rating summary in cache:", err);
    }
  }
}

export const reviewCache = new ReviewCache();
