import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { createRedisService, cacheRead, cacheSet, cacheDel, type RedisService as SharedRedisService } from "@repo/redis";
import { env } from "../config/env.js";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisInstance: SharedRedisService | null = null;

  async onModuleInit() {
    if (env.NODE_ENV === "test") {
      return;
    }

    try {
      this.redisInstance = createRedisService({
        url: env.REDIS_URL,
        keyPrefix: "vendor:v1:",
        serviceName: "vendor-service",
      });
      this.logger.log("Redis service initialized");
    } catch (err) {
      this.logger.error("Failed to initialize Redis service", err);
    }
  }

  async onModuleDestroy() {
    if (this.redisInstance) {
      await this.redisInstance.close();
      this.logger.log("Redis service connection closed");
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisInstance) return null;
    const result = await cacheRead<T>(this.redisInstance.client, this.redisInstance.keys.simple(key));
    if (result.status === "hit") {
      return result.value;
    }
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    if (!this.redisInstance) return;
    await cacheSet(this.redisInstance.client, this.redisInstance.keys.simple(key), value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.redisInstance) return;
    await cacheDel(this.redisInstance.client, this.redisInstance.keys.simple(key));
  }
}
