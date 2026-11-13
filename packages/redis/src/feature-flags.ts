/**
 * Dynamic Feature Flagging Engine with Redis Persistence and OpenFeature-compatible semantics.
 *
 * Supports:
 * - Sub-millisecond local in-memory caching with Redis Pub/Sub invalidation.
 * - Deterministic percentage-based canary rollouts via CRC16 slot hashing.
 * - Attribute-based targeting rules (equals, not_equals, in, not_in, contains, regex, greater_than, less_than).
 * - Multi-variant evaluation (boolean, string, number, object).
 * - OpenFeature resolution structure and evaluation reasons.
 */

import type Redis from "ioredis";
import { crc16 } from "./key-builder.js";

export type FlagValueType = boolean | string | number | Record<string, any> | any[];

export type EvaluationReason =
  | "DISABLED"
  | "STATIC"
  | "TARGETING_MATCH"
  | "PERCENTAGE_ROLLOUT"
  | "DEFAULT"
  | "ERROR";

export interface EvaluationContext {
  targetingKey?: string;
  attributes?: Record<string, string | number | boolean | string[] | undefined | null>;
}

export type RuleOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "regex"
  | "greater_than"
  | "less_than";

export interface FeatureFlagRule<T = any> {
  id: string;
  attribute: string;
  operator: RuleOperator;
  values: (string | number | boolean)[];
  variation?: string;
  value?: T;
}

export interface FeatureFlagRollout {
  percentage: number; // 0 to 100
  stickinessAttribute?: string; // defaults to targetingKey
  trueVariation?: string;
  falseVariation?: string;
}

export interface FeatureFlagDefinition<T = any> {
  key: string;
  enabled: boolean;
  defaultValue: T;
  variations?: Record<string, T>;
  defaultVariation?: string;
  disabledVariation?: string;
  rules?: FeatureFlagRule<T>[];
  rollout?: FeatureFlagRollout;
  description?: string;
  version?: number;
  updatedAt?: string;
}

export interface EvaluationResult<T = any> {
  value: T;
  variant?: string;
  reason: EvaluationReason;
  flagKey: string;
}

export interface FeatureFlagEngineOptions {
  redis: Redis;
  subscriberClient?: Redis;
  keyPrefix?: string;
  cacheTtlMs?: number;
  logger?: {
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export class FeatureFlagEngine {
  private readonly redis: Redis;
  private readonly subClient?: Redis;
  private readonly keyPrefix: string;
  private readonly cacheTtlMs: number;
  private readonly logger?: FeatureFlagEngineOptions["logger"];

  // Local in-memory cache: flagKey -> { def, cachedAt }
  private readonly localCache = new Map<string, { def: FeatureFlagDefinition<any> | null; cachedAt: number }>();
  private isSubscribed = false;

  constructor(options: FeatureFlagEngineOptions) {
    this.redis = options.redis;
    this.subClient = options.subscriberClient;
    this.keyPrefix = options.keyPrefix ?? "ff:";
    this.cacheTtlMs = options.cacheTtlMs ?? 15_000;
    this.logger = options.logger;

    if (this.subClient) {
      this.initSubscriber();
    }
  }

  private flagKey(key: string): string {
    return `${this.keyPrefix}flag:${key}`;
  }

  private channelKey(): string {
    return `${this.keyPrefix}events:invalidation`;
  }

  private initSubscriber(): void {
    if (!this.subClient || this.isSubscribed) return;
    const channel = this.channelKey();

    this.subClient.subscribe(channel, (err) => {
      if (err) {
        this.logger?.warn(`[FeatureFlags] Failed to subscribe to invalidation channel: ${err.message}`);
      } else {
        this.isSubscribed = true;
      }
    });

    this.subClient.on("message", (chan, message) => {
      if (chan === channel) {
        try {
          const payload = JSON.parse(message);
          if (payload.flagKey) {
            this.localCache.delete(payload.flagKey);
          } else {
            this.localCache.clear();
          }
        } catch {
          this.localCache.clear();
        }
      }
    });
  }

  /**
   * Clears in-memory evaluation cache
   */
  public clearLocalCache(flagKey?: string): void {
    if (flagKey) {
      this.localCache.delete(flagKey);
    } else {
      this.localCache.clear();
    }
  }

  /**
   * Retrieves flag definition with local cache + Redis fallback
   */
  public async getFlag<T = any>(flagKey: string): Promise<FeatureFlagDefinition<T> | null> {
    const now = Date.now();
    const cached = this.localCache.get(flagKey);

    if (cached && (now - cached.cachedAt) < this.cacheTtlMs) {
      return cached.def as FeatureFlagDefinition<T> | null;
    }

    try {
      const raw = await this.redis.get(this.flagKey(flagKey));
      if (!raw) {
        this.localCache.set(flagKey, { def: null, cachedAt: now });
        return null;
      }

      const parsed = JSON.parse(raw) as FeatureFlagDefinition<T>;
      this.localCache.set(flagKey, { def: parsed, cachedAt: now });
      return parsed;
    } catch (err: any) {
      this.logger?.error(`[FeatureFlags] Error fetching flag ${flagKey}: ${err.message}`);
      return null;
    }
  }

  /**
   * Saves or updates a feature flag definition in Redis and publishes invalidation
   */
  public async setFlag<T = any>(flag: FeatureFlagDefinition<T>): Promise<void> {
    const enriched: FeatureFlagDefinition<T> = {
      ...flag,
      version: (flag.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    const redisKey = this.flagKey(flag.key);
    await this.redis.set(redisKey, JSON.stringify(enriched));

    // Clear local cache immediately
    this.localCache.delete(flag.key);

    // Publish invalidation event for distributed nodes
    try {
      await this.redis.publish(this.channelKey(), JSON.stringify({ flagKey: flag.key }));
    } catch (publishErr: any) {
      this.logger?.warn(`[FeatureFlags] Invalidation publish warning: ${publishErr.message}`);
    }
  }

  /**
   * Toggles flag enabled state
   */
  public async toggleFlag(flagKey: string, enabled: boolean): Promise<boolean> {
    const existing = await this.getFlag(flagKey);
    if (!existing) return false;

    existing.enabled = enabled;
    await this.setFlag(existing);
    return true;
  }

  /**
   * Updates percentage rollout for a flag
   */
  public async setRolloutPercentage(flagKey: string, percentage: number): Promise<boolean> {
    const existing = await this.getFlag(flagKey);
    if (!existing) return false;

    const clamped = Math.max(0, Math.min(100, percentage));
    existing.rollout = {
      ...(existing.rollout ?? {}),
      percentage: clamped,
    };
    await this.setFlag(existing);
    return true;
  }

  /**
   * Deletes a feature flag from Redis
   */
  public async deleteFlag(flagKey: string): Promise<boolean> {
    const deleted = await this.redis.del(this.flagKey(flagKey));
    this.localCache.delete(flagKey);

    try {
      await this.redis.publish(this.channelKey(), JSON.stringify({ flagKey }));
    } catch {}

    return deleted > 0;
  }

  /**
   * Lists all feature flags in the namespace
   */
  public async listFlags(): Promise<FeatureFlagDefinition<any>[]> {
    const pattern = `${this.keyPrefix}flag:*`;
    const keys = await this.redis.keys(pattern);
    if (!keys || keys.length === 0) return [];

    const rawValues = await this.redis.mget(keys);
    const flags: FeatureFlagDefinition<any>[] = [];

    for (const raw of rawValues) {
      if (raw) {
        try {
          flags.push(JSON.parse(raw));
        } catch {}
      }
    }

    return flags;
  }

  /**
   * OpenFeature-compatible flag evaluation
   */
  public async evaluate<T = any>(
    flagKey: string,
    defaultValue: T,
    context?: EvaluationContext
  ): Promise<EvaluationResult<T>> {
    try {
      const flag = await this.getFlag<T>(flagKey);

      if (!flag) {
        return {
          value: defaultValue,
          reason: "DEFAULT",
          flagKey,
        };
      }

      // 1. Check if flag is disabled
      if (!flag.enabled) {
        if (flag.disabledVariation && flag.variations && flag.variations[flag.disabledVariation] !== undefined) {
          return {
            value: flag.variations[flag.disabledVariation]!,
            variant: flag.disabledVariation,
            reason: "DISABLED",
            flagKey,
          };
        }
        return {
          value: flag.defaultValue ?? defaultValue,
          variant: flag.defaultVariation,
          reason: "DISABLED",
          flagKey,
        };
      }

      // 2. Check targeting rules in sequential order
      if (flag.rules && flag.rules.length > 0 && context?.attributes) {
        for (const rule of flag.rules) {
          if (this.matchesRule(rule, context.attributes)) {
            let matchedValue: T = defaultValue;
            let variant: string | undefined = rule.variation;

            if (rule.variation && flag.variations && flag.variations[rule.variation] !== undefined) {
              matchedValue = flag.variations[rule.variation]!;
            } else if (rule.value !== undefined) {
              matchedValue = rule.value;
            } else if (flag.defaultValue !== undefined) {
              matchedValue = flag.defaultValue;
            }

            return {
              value: matchedValue,
              variant,
              reason: "TARGETING_MATCH",
              flagKey,
            };
          }
        }
      }

      // 3. Check percentage-based canary rollout
      if (flag.rollout && flag.rollout.percentage > 0) {
        const stickinessAttr = flag.rollout.stickinessAttribute;
        const stickinessValue = stickinessAttr && context?.attributes
          ? String(context.attributes[stickinessAttr] ?? "")
          : (context?.targetingKey ?? "");

        if (stickinessValue) {
          // Deterministic hash combining stickinessValue + flagKey
          const hashSeed = `${stickinessValue}:${flagKey}`;
          const bucket = crc16(hashSeed) % 100;

          if (bucket < flag.rollout.percentage) {
            const varName = flag.rollout.trueVariation ?? "treatment";
            const val = flag.variations?.[varName] ?? (typeof flag.defaultValue === "boolean" ? true as unknown as T : flag.defaultValue);
            return {
              value: val,
              variant: varName,
              reason: "PERCENTAGE_ROLLOUT",
              flagKey,
            };
          } else {
            const varName = flag.rollout.falseVariation ?? "control";
            const val = flag.variations?.[varName] ?? (typeof flag.defaultValue === "boolean" ? false as unknown as T : flag.defaultValue);
            return {
              value: val,
              variant: varName,
              reason: "PERCENTAGE_ROLLOUT",
              flagKey,
            };
          }
        }
      }

      // 4. Fallback to default variation/value
      if (flag.defaultVariation && flag.variations && flag.variations[flag.defaultVariation] !== undefined) {
        return {
          value: flag.variations[flag.defaultVariation]!,
          variant: flag.defaultVariation,
          reason: "STATIC",
          flagKey,
        };
      }

      return {
        value: flag.defaultValue ?? defaultValue,
        variant: flag.defaultVariation,
        reason: "STATIC",
        flagKey,
      };
    } catch (err: any) {
      this.logger?.error(`[FeatureFlags] Evaluation failure on ${flagKey}: ${err.message}`);
      return {
        value: defaultValue,
        reason: "ERROR",
        flagKey,
      };
    }
  }

  /**
   * Typed evaluation shortcuts
   */
  public async getBooleanValue(flagKey: string, defaultValue: boolean, context?: EvaluationContext): Promise<boolean> {
    const res = await this.evaluate<boolean>(flagKey, defaultValue, context);
    return Boolean(res.value);
  }

  public async getStringValue(flagKey: string, defaultValue: string, context?: EvaluationContext): Promise<string> {
    const res = await this.evaluate<string>(flagKey, defaultValue, context);
    return String(res.value);
  }

  public async getNumberValue(flagKey: string, defaultValue: number, context?: EvaluationContext): Promise<number> {
    const res = await this.evaluate<number>(flagKey, defaultValue, context);
    const num = Number(res.value);
    return isNaN(num) ? defaultValue : num;
  }

  public async getObjectValue<T = any>(flagKey: string, defaultValue: T, context?: EvaluationContext): Promise<T> {
    const res = await this.evaluate<T>(flagKey, defaultValue, context);
    return res.value;
  }

  /**
   * Rule evaluation helper
   */
  private matchesRule(rule: FeatureFlagRule, attributes: Record<string, any>): boolean {
    const val = attributes[rule.attribute];
    if (val === undefined || val === null) return false;

    switch (rule.operator) {
      case "equals":
        return rule.values.some((v) => String(v) === String(val));
      case "not_equals":
        return !rule.values.some((v) => String(v) === String(val));
      case "in":
        return rule.values.some((v) => String(v) === String(val));
      case "not_in":
        return !rule.values.some((v) => String(v) === String(val));
      case "contains":
        return String(val).toLowerCase().includes(String(rule.values[0] ?? "").toLowerCase());
      case "regex":
        try {
          const re = new RegExp(String(rule.values[0]));
          return re.test(String(val));
        } catch {
          return false;
        }
      case "greater_than":
        return Number(val) > Number(rule.values[0]);
      case "less_than":
        return Number(val) < Number(rule.values[0]);
      default:
        return false;
    }
  }

  public async close(): Promise<void> {
    if (this.subClient && this.isSubscribed) {
      try {
        await this.subClient.unsubscribe(this.channelKey());
        this.isSubscribed = false;
      } catch {}
    }
    this.localCache.clear();
  }
}

/**
 * Factory for creating a FeatureFlagEngine instance
 */
export function createFeatureFlagEngine(options: FeatureFlagEngineOptions): FeatureFlagEngine {
  return new FeatureFlagEngine(options);
}
