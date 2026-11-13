/**
 * Redis-backed storage adapter for Canary Prober history and failure tracking.
 */

import type {
  CanaryProbeRun,
  CanaryScenarioType,
  CanaryStorageAdapter,
} from "@repo/monitoring";
import type { RedisService } from "@repo/redis";

type RedisClient = RedisService["client"];

export class RedisCanaryStorage implements CanaryStorageAdapter {
  private readonly redis: RedisClient;
  private readonly listKeyPrefix: string;
  private readonly failureKeyPrefix: string;

  constructor(redis: RedisClient, keyPrefix = "canary:") {
    this.redis = redis;
    this.listKeyPrefix = `${keyPrefix}history:`;
    this.failureKeyPrefix = `${keyPrefix}failures:`;
  }

  async pushRun(run: CanaryProbeRun): Promise<void> {
    const listKey = `${this.listKeyPrefix}${run.scenario}`;
    const allListKey = `${this.listKeyPrefix}all`;
    const serialized = JSON.stringify(run);

    const pipeline = this.redis.pipeline();
    pipeline.lpush(listKey, serialized);
    pipeline.ltrim(listKey, 0, 199);
    pipeline.lpush(allListKey, serialized);
    pipeline.ltrim(allListKey, 0, 199);

    const failureKey = `${this.failureKeyPrefix}${run.scenario}`;
    if (run.success) {
      pipeline.set(failureKey, "0");
    } else {
      pipeline.incr(failureKey);
    }

    await pipeline.exec();
  }

  async getRuns(
    scenario?: CanaryScenarioType,
    limit = 50,
  ): Promise<CanaryProbeRun[]> {
    const listKey = scenario
      ? `${this.listKeyPrefix}${scenario}`
      : `${this.listKeyPrefix}all`;

    const raw = await this.redis.lrange(listKey, 0, Math.max(0, limit - 1));
    const runs: CanaryProbeRun[] = [];

    for (const item of raw) {
      try {
        runs.push(JSON.parse(item));
      } catch {}
    }

    return runs;
  }

  async getConsecutiveFailures(scenario: CanaryScenarioType): Promise<number> {
    const failureKey = `${this.failureKeyPrefix}${scenario}`;
    const val = await this.redis.get(failureKey);
    return val ? Number.parseInt(val, 10) || 0 : 0;
  }
}
