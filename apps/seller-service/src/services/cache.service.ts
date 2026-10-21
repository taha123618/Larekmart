import {
  createRedisService,
  cacheRead,
  cacheSet,
  cacheDel,
  type RedisService,
} from "@repo/redis";
import { env } from "../config/env.js";

class CacheService {
  private service: RedisService | null = null;

  public getRedis(): RedisService {
    if (!this.service) {
      this.service = createRedisService({
        url: env.REDIS_URL,
        keyPrefix: "seller:v1:",
        serviceName: "seller-service",
      });
    }
    return this.service;
  }

  public async getStorefrontBySlug<T>(slug: string): Promise<T | null> {
    try {
      const redis = this.getRedis();
      const res = await cacheRead<T>(redis.client, `storefront:slug:${slug}`);
      return res.status === "hit" ? res.value : null;
    } catch {
      return null;
    }
  }

  public async setStorefrontBySlug<T>(
    slug: string,
    value: T,
    ttlSeconds = 300
  ): Promise<void> {
    try {
      const redis = this.getRedis();
      await cacheSet(redis.client, `storefront:slug:${slug}`, value, ttlSeconds);
    } catch {
      // cache write failures shouldn't throw to caller
    }
  }

  public async invalidateStorefront(slug: string, sellerId: string): Promise<void> {
    try {
      const redis = this.getRedis();
      await cacheDel(redis.client, `storefront:slug:${slug}`);
      await cacheDel(redis.client, `storefront:seller:${sellerId}`);
    } catch {
      // non-blocking
    }
  }

  public async close(): Promise<void> {
    if (this.service) {
      await this.service.close();
      this.service = null;
    }
  }
}

export const cacheService = new CacheService();
