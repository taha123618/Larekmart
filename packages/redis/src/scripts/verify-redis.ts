/**
 * Opt-in integration check for `@repo/redis`.
 *
 * Type checking cannot prove how this package behaves against a real server, so
 * this script exercises the parts that matter and exits non-zero on the first
 * regression. It covers:
 *
 * - key namespacing and prefix normalisation
 * - cache round trip, TTLs, misses, and deletes
 * - read *outcomes*: `cacheRead` must report `hit`, `miss`, and — when Redis is
 *   unreachable — `error`. A caller that collapsed `error` into `miss` would
 *   report a Redis outage as a 0% hit rate, so this is asserted separately.
 * - the namespace-version bump, including the first bump — plain `INCR` used to
 *   return a version readers already held, which silently skipped the first
 *   cache invalidation. The check covers the numeric invariant (`after >
 *   before`, `next > after`), the *behaviour* it protects (a bumped reader no
 *   longer resolves the previous version's entry, while that entry is still
 *   stored and simply unreachable), a long run of bumps (the offset used to
 *   compound and overflow Redis's integer at ~63 bumps, freezing the version),
 *   and the degraded case (the bump still advances the in-memory fallback so a
 *   recovery cannot resurrect old entries)
 * - the rate limiter's window and its guaranteed bucket TTL (`EXPIRE ... NX`)
 * - degraded behaviour: an unreachable Redis must not throw from the cache
 *   helpers, and `checkRateLimit` must reject so callers can fail open
 *
 * It runs against a real Redis and is deliberately **not** part of
 * `pnpm check-types` or `pnpm build`:
 *
 *   docker compose -f packages/redis/docker-compose.yml up -d
 *   pnpm --filter @repo/redis verify:redis
 *   REDIS_URL=redis://localhost:6379 pnpm --filter @repo/redis verify:redis
 *
 * Keys are written under a run-scoped prefix and deleted on the way out, so a
 * shared development Redis is left exactly as it was found.
 */
import {
  bumpNamespaceVersion,
  cacheDel,
  cacheRead,
  cacheSet,
  checkRateLimit,
  createRedisService,
  getNamespaceVersion,
} from "../index.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

/** Unique per run so concurrent or repeated runs cannot collide. */
const RUN_PREFIX = `verify:${process.pid}:${Date.now()}:`;

/** Nothing listens here; used to assert the degraded paths. */
const UNREACHABLE_URL =
  process.env.REDIS_UNREACHABLE_URL ?? "redis://127.0.0.1:65533";

const createdKeys: string[] = [];
let failures = 0;

function check(label: string, passed: boolean, details?: unknown): void {
  if (!passed) failures += 1;
  const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${suffix}`);
}

function expectEqual<T>(label: string, actual: T, expected: T): void {
  check(
    label,
    actual === expected,
    actual === expected ? undefined : { actual, expected },
  );
}

async function main(): Promise<void> {
  const redis = createRedisService({
    url: REDIS_URL,
    keyPrefix: RUN_PREFIX,
    serviceName: "verify-redis",
  });

  if (!(await redis.ping())) {
    console.error(`\nCould not reach Redis at ${REDIS_URL}.`);
    console.error(
      "Start it with: docker compose -f packages/redis/docker-compose.yml up -d\n",
    );
    process.exitCode = 1;
    return;
  }

  // 1. Key building
  expectEqual(
    "keys.namespace composes with ':'",
    redis.keys.namespace("q", "abc"),
    `${RUN_PREFIX}q:abc`,
  );
  const noColon = createRedisService({
    url: REDIS_URL,
    keyPrefix: "verify-no-colon",
    serviceName: "verify-redis",
  });
  expectEqual(
    "keyPrefix gains a trailing ':'",
    noColon.keys.simple("x"),
    "verify-no-colon:x",
  );

  // 2. Cache round trip, TTL, outcomes, delete
  const cacheKey = redis.keys.namespace("q", "abc");
  createdKeys.push(cacheKey);
  await cacheSet(redis.client, cacheKey, { hello: "world" }, 30);
  const roundTripped = await cacheRead<{ hello: string }>(
    redis.client,
    cacheKey,
  );
  expectEqual("cacheRead reports a hit", roundTripped.status, "hit");
  expectEqual(
    "cacheSet/cacheRead round trip",
    roundTripped.status === "hit" ? roundTripped.value.hello : undefined,
    "world",
  );

  const ttl = await redis.client.ttl(cacheKey);
  check("cacheSet applies a TTL", ttl > 0 && ttl <= 30, { ttl });

  // `miss` (nothing stored) must be distinguishable from `error` (Redis down),
  // otherwise a Redis outage is reported as a 0% hit rate.
  const absent = await cacheRead(redis.client, redis.keys.simple("absent"));
  expectEqual("cacheRead reports a miss", absent.status, "miss");
  expectEqual("a miss carries a null value", absent.value, null);

  const corruptKey = redis.keys.namespace("q", "corrupt");
  createdKeys.push(corruptKey);
  await redis.client.set(corruptKey, "{not-json", "EX", 30);
  expectEqual(
    "an undecodable payload is a miss, not an error",
    (await cacheRead(redis.client, corruptKey)).status,
    "miss",
  );

  expectEqual(
    "cacheDel reports the delete",
    await cacheDel(redis.client, cacheKey),
    true,
  );

  // 3. Namespace versioning (bulk invalidation)
  const versionKey = redis.keys.simple("namespace_version");
  createdKeys.push(versionKey);
  const before = await getNamespaceVersion(redis.client, versionKey, {
    value: 1,
  });
  const after = await bumpNamespaceVersion(redis.client, versionKey, {
    value: before,
  });
  check("first bump moves past the in-memory version", after > before, {
    before,
    after,
  });
  expectEqual(
    "stored version matches the returned one",
    await redis.client.get(versionKey),
    String(after),
  );
  expectEqual(
    "readers see the bumped version",
    await getNamespaceVersion(redis.client, versionKey, { value: 1 }),
    after,
  );

  // `after > before` is only a proxy for the real property. What the fix
  // protects is that a reader stops resolving entries written under the
  // previous version, so assert that too: a change that dropped the version
  // from the key layout would keep the numeric check passing while silently
  // disabling invalidation completely.
  const staleKey = redis.keys.namespace(`v${after}`, "q", "stale");
  createdKeys.push(staleKey);
  await cacheSet(redis.client, staleKey, { stale: true }, 60);
  expectEqual(
    "an entry written under the current version is readable",
    (await cacheRead(redis.client, staleKey)).status,
    "hit",
  );

  const nextVersion = await bumpNamespaceVersion(redis.client, versionKey, {
    value: after,
  });
  check("repeated bumps keep advancing", nextVersion > after, {
    after,
    nextVersion,
  });
  expectEqual(
    "the bumped reader no longer resolves the old entry",
    (
      await cacheRead(
        redis.client,
        redis.keys.namespace(`v${nextVersion}`, "q", "stale"),
      )
    ).status,
    "miss",
  );
  // Invalidation is by namespace, not by deletion: the old entry must still be
  // stored, which is what lets it expire naturally instead of needing a scan.
  expectEqual(
    "the old entry is still stored, just unreachable",
    (await cacheRead(redis.client, staleKey)).status,
    "hit",
  );

  // The bump offset used to compound: adding `fallback + 1` on every call
  // doubled the stored value until it overflowed Redis's 64-bit integer at ~63
  // bumps, after which every bump silently took the error path and the version
  // froze — invalidation quietly stopping for any long-lived process, which is
  // invisible to type checking and only shows up in production. A long run pins
  // both the monotonicity and the growth rate.
  const BUMPS = 70;
  let previousBump = nextVersion;
  let nonMonotonic = 0;
  let nonUnitAdvance = 0;
  for (let i = 0; i < BUMPS; i++) {
    const bumped = await bumpNamespaceVersion(redis.client, versionKey, {
      value: previousBump,
    });
    if (bumped <= previousBump) nonMonotonic += 1;
    if (bumped !== previousBump + 1) nonUnitAdvance += 1;
    previousBump = bumped;
  }
  check(
    `${BUMPS} consecutive bumps stay strictly increasing`,
    nonMonotonic === 0,
    { nonMonotonic, finalVersion: previousBump },
  );
  check(
    `${BUMPS} consecutive bumps advance by exactly one`,
    nonUnitAdvance === 0,
    {
      nextVersion,
      finalVersion: previousBump,
      nonUnitAdvance,
    },
  );
  expectEqual(
    "the long-run version is persisted",
    await redis.client.get(versionKey),
    String(previousBump),
  );

  // 4. Rate limiter
  const rateLimitKey = redis.keys.simple("ratelimit:verify");
  createdKeys.push(rateLimitKey);
  const options = { key: rateLimitKey, maxRequests: 2, windowSeconds: 60 };
  const first = await checkRateLimit(redis.client, options);
  const second = await checkRateLimit(redis.client, options);
  const third = await checkRateLimit(redis.client, options);
  check("allows the first maxRequests calls", first.allowed && second.allowed, {
    first: first.allowed,
    second: second.allowed,
  });
  check("blocks the call after the limit", !third.allowed, {
    remaining: third.remaining,
    resetIn: third.resetIn,
  });
  const rateLimitTtl = await redis.client.ttl(rateLimitKey);
  check("bucket always has a TTL (EXPIRE ... NX)", rateLimitTtl > 0, {
    ttl: rateLimitTtl,
  });

  // 5. Everything written is namespaced
  const stored = await redis.client.keys(`${RUN_PREFIX}*`);
  check(
    "server keys all live under the prefix",
    stored.length > 0 && stored.every((key) => key.startsWith(RUN_PREFIX)),
    {
      stored,
    },
  );

  // 6. Cleanup before the degraded checks so a shared Redis stays untouched.
  for (const key of createdKeys) {
    await cacheDel(redis.client, key);
  }
  check(
    "run keys are cleaned up",
    (await redis.client.keys(`${RUN_PREFIX}*`)).length === 0,
  );

  await redis.close();

  // 7. Degraded behaviour when Redis is unreachable
  const unreachable = createRedisService({
    url: UNREACHABLE_URL,
    keyPrefix: RUN_PREFIX,
    serviceName: "verify-redis-unreachable",
    maxRetries: 0,
    maxRetryDelayMs: 10,
  });
  try {
    expectEqual(
      "ping() is false when unreachable",
      await unreachable.ping(),
      false,
    );
    // The whole point of the `error` status: an unreachable cache must be
    // distinguishable from a cold one.
    const unreachableRead = await cacheRead(
      unreachable.client,
      unreachable.keys.simple("x"),
    );
    expectEqual(
      "cacheRead reports an error when unreachable",
      unreachableRead.status,
      "error",
    );
    expectEqual("an error carries a null value", unreachableRead.value, null);
    check(
      "cacheSet does not throw when unreachable",
      await cacheSet(
        unreachable.client,
        unreachable.keys.simple("x"),
        1,
        5,
      ).then(
        () => true,
        () => false,
      ),
    );
    check(
      "checkRateLimit rejects when unreachable (callers fail open)",
      await checkRateLimit(unreachable.client, {
        key: unreachable.keys.simple("rl"),
        maxRequests: 1,
        windowSeconds: 60,
      }).then(
        () => false,
        () => true,
      ),
    );

    // The bump must still move forward while Redis is down, otherwise a
    // mutation during an outage would leave stale entries reachable again once
    // the connection recovers.
    const memoryVersion = { value: 7 };
    const degradedBump = await bumpNamespaceVersion(
      unreachable.client,
      unreachable.keys.simple("namespace_version"),
      memoryVersion,
    );
    check("bump still advances while unreachable", degradedBump > 7, {
      degradedBump,
    });
    expectEqual(
      "the degraded bump is written back to the fallback",
      memoryVersion.value,
      degradedBump,
    );
  } finally {
    // Expected to log an error: the connection was never established.
    await unreachable.close();
  }

  console.log(
    failures === 0
      ? "\nAll @repo/redis integration checks passed."
      : `\n${failures} @repo/redis integration check(s) FAILED.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error("Integration check crashed:", error);
  process.exitCode = 1;
});
