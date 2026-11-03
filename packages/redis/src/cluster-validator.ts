import type { Redis } from "ioredis";
import {
  calculateClusterSlot,
  createClusterHashTag,
  extractClusterHashTag,
  createTenantWarehouseHashTag,
  DEFAULT_TENANT_ID,
  TENANT_WAREHOUSE_TAG_PATTERN,
} from "./key-builder.js";

export {
  createTenantWarehouseHashTag,
  DEFAULT_TENANT_ID,
  TENANT_WAREHOUSE_TAG_PATTERN,
};

/**
 * Thrown when keys in a multi-key operation (such as a Lua script or transaction)
 * resolve to conflicting Redis Cluster slots (CRC16 % 16384), which would cause
 * fatal `CROSSSLOT Keys in request don't hash to the same slot` exceptions in production.
 */
export class CrossSlotValidationError extends Error {
  public readonly keys: string[];
  public readonly slots: number[];
  public readonly tags: (string | null)[];

  constructor(
    message: string,
    keys: string[],
    slots: number[],
    tags: (string | null)[],
  ) {
    super(message);
    this.name = "CrossSlotValidationError";
    this.keys = keys;
    this.slots = slots;
    this.tags = tags;
    Object.setPrototypeOf(this, CrossSlotValidationError.prototype);
  }
}

/**
 * Thrown when a key fails structural bracket tagging requirements.
 */
export class InvalidHashTagError extends Error {
  public readonly key: string;
  public readonly extractedTag: string | null;

  constructor(
    message: string,
    key: string,
    extractedTag: string | null = null,
  ) {
    super(message);
    this.name = "InvalidHashTagError";
    this.key = key;
    this.extractedTag = extractedTag;
    Object.setPrototypeOf(this, InvalidHashTagError.prototype);
  }
}

/**
 * Validates that a Redis key possesses a valid {...} hash tag, and verifies that the tag
 * conforms to the required structural pattern (defaulting to TENANT_WAREHOUSE_TAG_PATTERN).
 *
 * @param key - The complete Redis key to validate.
 * @param requiredPattern - Optional RegExp pattern to test the inner tag. Defaults to TENANT_WAREHOUSE_TAG_PATTERN.
 * @returns The validated extracted tag string.
 * @throws {InvalidHashTagError} If the key lacks a tag or violates the structural pattern.
 */
export function validateClusterHashTag(
  key: string,
  requiredPattern: RegExp = TENANT_WAREHOUSE_TAG_PATTERN,
): string {
  const tag = extractClusterHashTag(key);
  if (!tag) {
    throw new InvalidHashTagError(
      `Key '${key}' does not contain a valid Redis Cluster hash tag '{...}'`,
      key,
      null,
    );
  }
  if (!requiredPattern.test(tag)) {
    throw new InvalidHashTagError(
      `Key '${key}' has hash tag '{${tag}}' which violates required pattern '${requiredPattern.source}' (must match {tenant_id:warehouse_id})`,
      key,
      tag,
    );
  }
  return tag;
}

export interface ClusterSlotAlignmentOptions {
  /**
   * Whether to require structural {...} hash tag verification on every key.
   * Defaults to true.
   */
  requireStructuralTag?: boolean;
  /**
   * Pattern required for the extracted hash tag.
   * Defaults to TENANT_WAREHOUSE_TAG_PATTERN.
   */
  tagPattern?: RegExp;
}

/**
 * Asserts that all provided Redis keys resolve to the exact same Redis Cluster CRC16 slot.
 *
 * Runs client-side validation *before* executing multi-key operations (Lua scripts, MGET, MSET, transactions).
 * This eliminates the risk of silent passes on single-node Redis (e.g., local Docker Compose) that would
 * trigger catastrophic `CROSSSLOT` exceptions when deployed against a multi-node Redis Cluster in production.
 *
 * @param keys - Array of Redis keys involved in the multi-key operation.
 * @param options - Configuration options for tag validation.
 * @returns The common CRC16 cluster slot index (0 - 16383).
 * @throws {InvalidHashTagError} If any key fails structural tag validation.
 * @throws {CrossSlotValidationError} If keys hash to different cluster slots.
 */
export function assertClusterSlotAlignment(
  keys: string[],
  options?: ClusterSlotAlignmentOptions,
): number {
  if (keys.length === 0) return 0;

  const requireStructural = options?.requireStructuralTag ?? true;
  const tagPattern = options?.tagPattern ?? TENANT_WAREHOUSE_TAG_PATTERN;

  const slots: number[] = [];
  const tags: (string | null)[] = [];

  for (const key of keys) {
    if (requireStructural) {
      const tag = validateClusterHashTag(key, tagPattern);
      tags.push(tag);
    } else {
      tags.push(extractClusterHashTag(key));
    }
    slots.push(calculateClusterSlot(key));
  }

  const firstSlot = slots[0]!;
  const hasMismatch = slots.some((s) => s !== firstSlot);

  if (hasMismatch) {
    throw new CrossSlotValidationError(
      `CROSSSLOT violation: Keys in multi-key operation do not hash to the same Redis cluster slot [${slots.join(", ")}]. Keys: [${keys.join(", ")}] with tags: [${tags.map((t) => (t ? `{${t}}` : "none")).join(", ")}]`,
      keys,
      slots,
      tags,
    );
  }

  return firstSlot;
}

/**
 * Cluster-safe Lua script evaluator for generic cluster keys.
 * Validates that all KEYS[1..numKeys] contain valid hash tags and map to the identical CRC16 slot
 * before sending the EVAL command to the Redis server.
 */
export async function evalClusterSafe(
  client: Redis,
  script: string,
  numKeys: number,
  ...args: (string | number)[]
): Promise<unknown> {
  const keys = args.slice(0, numKeys).map(String);
  if (keys.length > 0) {
    assertClusterSlotAlignment(keys, {
      requireStructuralTag: true,
      tagPattern: /^.+$/, // Non-empty tag check
    });
  }
  return client.eval(script, numKeys, ...args);
}

/**
 * Cluster-safe Lua script evaluator strictly enforcing {tenant_id:warehouse_id} slot tagging.
 *
 * Used for inventory, stock allocation, and warehouse mutations to guarantee slot-pinning
 * across multi-tenant shards.
 */
export async function evalTenantWarehouseSafe(
  client: Redis,
  script: string,
  numKeys: number,
  ...args: (string | number)[]
): Promise<unknown> {
  const keys = args.slice(0, numKeys).map(String);
  if (keys.length > 0) {
    assertClusterSlotAlignment(keys, {
      requireStructuralTag: true,
      tagPattern: TENANT_WAREHOUSE_TAG_PATTERN,
    });
  }
  return client.eval(script, numKeys, ...args);
}
