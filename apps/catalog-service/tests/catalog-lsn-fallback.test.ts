/**
 * catalog-lsn-fallback.test.ts
 *
 * Standalone tsx-run test suite covering the LSN-aware Read-Your-Writes
 * replica lag fallback (dynamic LSN tracking) in catalog-service.
 * Follows the internal runner convention of tests/catalog-service.test.ts.
 *
 * Covered behaviors:
 *   1. Pure lag-decision function (`isReplicaLagging`) under WAL orderings.
 *   2. Plugin integration: a session whose cached LSN is ahead of the replica
 *      replay position is routed to the primary; a caught-up replica routes
 *      to the replica plane; no session LSN preserves baseline behavior.
 */
import assert from "node:assert/strict";
import Fastify from "fastify";
import { GATEWAY_HEADERS } from "@repo/types";
import { buildReadYourWritesLsnKey, parseLSN } from "@repo/redis";
import { redis } from "../src/utils/redis.js";
import { configureFastifyPlugins } from "../src/plugins/fastify.js";
import {
  databaseContext,
  isReplicaLagging,
  replicaWal,
} from "../src/utils/database-context.js";

const SESSION_LSN_TTL_MS = 10_000;

async function setSessionLsn(sessionId: string, lsn: string): Promise<void> {
  // Seed only the LSN key (not the time-based lease) so the integration test
  // isolates the LSN-aware routing path from the 500ms lease path.
  await redis.client.set(
    buildReadYourWritesLsnKey(sessionId),
    lsn,
    "PX",
    SESSION_LSN_TTL_MS,
  );
}

async function runLsnFallbackTests(): Promise<void> {
  console.log("==================================================");
  console.log("📊 catalog-service LSN-aware Read-Your-Writes fallback tests");
  console.log("==================================================");

  // ---------------------------------------------------------------------------
  // TEST 1: Pure lag-decision function (`isReplicaLagging`)
  // ---------------------------------------------------------------------------
  console.log("\n1. Testing isReplicaLagging WAL ordering invariants...");

  // 1A. No session LSN -> never force primary
  assert.equal(
    isReplicaLagging(null, "16/B374D848"),
    false,
    "Null session LSN must resolve to replica routing",
  );

  // 1B. Malformed session LSN -> never force primary
  assert.equal(
    isReplicaLagging("not-an-lsn", "16/B374D848"),
    false,
    "Malformed session LSN must resolve to replica routing",
  );

  // 1C. Replica replay position ahead of session LSN -> replica is safe
  assert.equal(
    isReplicaLagging("0/10", "16/B374D848"),
    false,
    "Caught-up replica must serve from replica plane",
  );

  // 1D. Equal positions -> replica is safe
  assert.equal(
    isReplicaLagging("16/B374D848", "16/B374D848"),
    false,
    "Equal WAL positions mean the replica has replayed the mutation",
  );

  // 1E. Replica behind session LSN -> force primary
  assert.equal(
    isReplicaLagging("16/B374D848", "16/B374D847"),
    true,
    "Lagging replica must force primary routing",
  );

  // 1F. Null replica replay position -> fail safe onto primary
  assert.equal(
    isReplicaLagging("0/10", null),
    true,
    "A replica that has replayed nothing must fail safe onto primary",
  );

  // 1G. Malformed replica position -> fail safe onto primary
  assert.equal(
    isReplicaLagging("0/10", "garbage"),
    true,
    "Malformed replica LSN must fail safe onto primary",
  );

  // 1H. parseLSN high/low word ordering
  assert.ok(
    parseLSN("16/B374D848") > parseLSN("15/FFFFFFFF"),
    "parseLSN must order by high word before low word",
  );
  assert.equal(parseLSN("bogus"), 0n, "Malformed LSN parses to 0n");
  console.log(
    "  ✓ isReplicaLagging decision function verified under all orderings",
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Plugin integration — session LSN drives primary/replica routing
  // ---------------------------------------------------------------------------
  console.log(
    "\n2. Testing Fastify LSN-aware routing via request injection...",
  );

  const app = Fastify({ logger: false });
  await configureFastifyPlugins(app);

  app.get("/test/consistency", async (request, reply) => {
    return reply.status(200).send({
      forcePrimary: request.forcePrimary,
      ambientPrimary: databaseContext.getStore()?.forcePrimary,
    });
  });

  await app.ready();

  const originalGetLsn = replicaWal.getLsn.bind(replicaWal);
  try {
    // 2A. Session LSN ahead of replica replay position -> primary routing
    const aheadSession = "sess_lsn_ahead_of_replica";
    await setSessionLsn(aheadSession, "16/B374D848");
    replicaWal.getLsn = async () => "16/B374D840"; // Replica lagging

    const laggedRes = await app.inject({
      method: "GET",
      url: "/test/consistency",
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: aheadSession },
    });
    assert.equal(laggedRes.statusCode, 200);
    const laggedJson = laggedRes.json() as {
      forcePrimary: boolean;
      ambientPrimary?: boolean;
    };
    assert.equal(
      laggedJson.forcePrimary,
      true,
      "Request must be routed to primary while session LSN exceeds replica replay LSN",
    );
    assert.equal(laggedJson.ambientPrimary, true);
    assert.equal(
      laggedRes.headers["x-consistency-plane"],
      "primary-master",
      "Lagging replica session must receive X-Consistency-Plane: primary-master",
    );
    console.log(
      "  ✓ Session LSN ahead of replay position forces primary routing",
    );

    // 2B. Replica caught up past the session LSN -> replica routing
    const caughtUpSession = "sess_lsn_replica_caught_up";
    await setSessionLsn(caughtUpSession, "0/10");
    replicaWal.getLsn = async () => "16/B374D848"; // Replica fully caught up

    const caughtUpRes = await app.inject({
      method: "GET",
      url: "/test/consistency",
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: caughtUpSession },
    });
    assert.equal(caughtUpRes.statusCode, 200);
    const caughtUpJson = caughtUpRes.json() as {
      forcePrimary: boolean;
      ambientPrimary?: boolean;
    };
    assert.equal(
      caughtUpJson.forcePrimary,
      false,
      "Caught-up replica must serve the request from the replica plane",
    );
    assert.equal(caughtUpJson.ambientPrimary, false);
    assert.equal(
      caughtUpRes.headers["x-consistency-plane"],
      undefined,
      "Replica-plane responses must not carry the primary telemetry header",
    );
    console.log(
      "  ✓ Replica replayed past session LSN routes back to replica plane",
    );

    // 2C. No cached session LSN -> baseline replica routing preserved
    const noLsnSession = "sess_lsn_never_mutated";
    replicaWal.getLsn = async () => {
      throw new Error(
        "Replica source must not be queried without a session LSN",
      );
    };

    const baselineRes = await app.inject({
      method: "GET",
      url: "/test/consistency",
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: noLsnSession },
    });
    assert.equal(baselineRes.statusCode, 200);
    const baselineJson = baselineRes.json() as {
      forcePrimary: boolean;
      ambientPrimary?: boolean;
    };
    assert.equal(
      baselineJson.forcePrimary,
      false,
      "Requests without a cached session LSN must keep replica routing",
    );
    console.log(
      "  ✓ Requests without session LSN skip replica probing entirely",
    );
  } finally {
    replicaWal.getLsn = originalGetLsn;
    // Cleanup seeded session keys
    for (const session of [
      "sess_lsn_ahead_of_replica",
      "sess_lsn_replica_caught_up",
    ]) {
      await redis.client.del(buildReadYourWritesLsnKey(session));
    }
    await app.close();
  }

  console.log("\n==================================================");
  console.log("🎉 All catalog LSN fallback tests passed cleanly!");
  console.log("==================================================");
}

runLsnFallbackTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("❌ catalog LSN fallback tests failed:", err);
    process.exit(1);
  });
