/**
 * catalog-lag-chaos-e2e.test.ts
 *
 * End-to-end chaos verification of the LSN-aware Read-Your-Writes replica
 * lag failover in catalog-service. Unlike the unit suites, this boots the
 * REAL catalog-service HTTP server (buildServer) against REAL Redis and
 * REAL PostgreSQL, replays the gateway's half of the contract for real
 * (mutation WAL position -> markReadYourWritesWithLSN), and asserts the
 * routing decision strictly on real HTTP response headers.
 *
 * Topology note: local docker-compose routes PgBouncer to the PRIMARY
 * (pg_last_wal_replay_lsn() returns NULL on a primary), which is exactly the
 * "standby replay position unavailable" failure that must fail safe onto the
 * primary. The lag-then-recovery experiment therefore substitutes a live
 * standby stand-in at the injected `replicaWal` probe seam — in production
 * that probe calls the hot standby's real `pg_last_wal_replay_lsn()`.
 * For full-infrastructure verification against a real hot standby, run
 * `infrastructure/chaos/catalog-replica-lag.yaml` via Chaos Mesh.
 */
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { GATEWAY_HEADERS } from "@repo/types";
import {
  buildReadYourWritesLsnKey,
  markReadYourWritesWithLSN,
  parseLSN,
} from "@repo/redis";
import { prisma, readPrisma } from "@repo/catalog-db";
import { buildServer } from "../src/server.js";
import { redis } from "../src/utils/redis.js";
import { replicaWal } from "../src/utils/database-context.js";

const SESSION_TTL_MS = 30_000;
const FALLBACK_LAG_BYTES = 65_536n; // 64 KiB simulated standby replay backlog
const LEASE_EXPIRY_WAIT_MS = 700; // > DEFAULT_RYW_TTL_MS (500ms) time lease

const chaosSessions = {
  replayUnavailable: "chaos_e2e_replay_unavailable",
  lagging: "chaos_e2e_standby_lagging",
  recovered: "chaos_e2e_standby_recovered",
};

/** Formats a parsed WAL position back into canonical lean LSN text. */
function lsnToString(position: bigint): string {
  const high = Number(position >> 32n);
  const low = Number(position & 0xffffffffn);
  return `${high.toString(16)}/${low.toString(16).padStart(8, "0")}`;
}

/** Keeps a parsed position from underflowing past the start of WAL. */
function safeSub(position: bigint, delta: bigint): bigint {
  return position > delta ? position - delta : 0n;
}

/**
 * Lets the 500ms time-based RYW lease expire so every routing assertion below
 * is attributable solely to the LSN-aware replica lag guard (mirrors real
 * behavior: the time lease governs the instant post-mutation window, and the
 * LSN comparison governs anything lagging beyond it).
 */
function waitForLeaseExpiry(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LEASE_EXPIRY_WAIT_MS));
}

/** The exact WAL query PostgreSQL-backed write services stamp as x-db-lsn. */
async function capturePrimaryWalLsn(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ lsn: string }>>
    `SELECT pg_current_wal_lsn()::text AS lsn`;
  const lsn = rows[0]?.lsn;
  if (!lsn) throw new Error("pg_current_wal_lsn() returned no position");
  return lsn;
}

interface ProbeCheck {
  primaryAlive: boolean;
  replicaEndpointAlive: boolean;
  redisAlive: boolean;
  replicaInRecovery: boolean;
  replicaReplayLsn: string | null;
}

/** Preflight: abort loudly if any live dependency of the e2e is unavailable. */
async function preflight(): Promise<ProbeCheck> {
  const primaryRows = await prisma.$queryRaw<Array<{ alive: number }>>
    `SELECT 1 AS alive`;
  const replicaRows = await readPrisma.$queryRaw<
    Array<{ alive: number; inRecovery: boolean; replay: string | null }>
  >`SELECT 1 AS alive, pg_is_in_recovery() AS "inRecovery", pg_last_wal_replay_lsn()::text AS replay`;
  const redisAlive = (await redis.client.ping()) === "PONG";

  return {
    primaryAlive: primaryRows[0]?.alive === 1,
    replicaEndpointAlive: replicaRows[0]?.alive === 1,
    redisAlive,
    replicaInRecovery: replicaRows[0]?.inRecovery === true,
    replicaReplayLsn: replicaRows[0]?.replay ?? null,
  };
}

async function runChaosE2e(): Promise<void> {
  console.log("==================================================");
  console.log("🌪️  catalog-service replication-lag failover chaos e2e");
  console.log("==================================================");

  const probe = await preflight();
  assert.equal(probe.primaryAlive, true, "PostgreSQL primary must be reachable");
  assert.equal(
    probe.replicaEndpointAlive,
    true,
    "Replica endpoint (DATABASE_READ_REPLICA_URL) must be reachable",
  );
  assert.equal(probe.redisAlive, true, "Redis must be reachable");
  console.log(
    `  • Preflight ok — replicaEndpoint inRecovery=${probe.replicaInRecovery}, replay=${probe.replicaReplayLsn ?? "null"}`,
  );

  // Boot the REAL catalog-service HTTP server on an ephemeral port
  const app = await buildServer();
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`  • catalog-service listening (real HTTP) on ${baseUrl}`);

  const originalGetLsn = replicaWal.getLsn.bind(replicaWal);
  const flashBuyerSessions: string[] = [];
  try {
    // -------------------------------------------------------------------------
    // Scenario A — standby replay position UNAVAILABLE (Chaos: replay probe
    // partitioned; locally also the real topology since PgBouncer fronts the
    // primary). Real replicaWal probe, no substitutions — fail safe expected.
    // -------------------------------------------------------------------------
    console.log(
      "\nA. Standby replay position unavailable → must fail safe onto primary",
    );

    const sessionA = chaosSessions.replayUnavailable;
    const mutationLsnA = await capturePrimaryWalLsn();
    const marked = await markReadYourWritesWithLSN(
      redis.client,
      sessionA,
      mutationLsnA,
      { lsnTtlMs: SESSION_TTL_MS },
    );
    assert.equal(marked, true, "Gateway-equivalent LSN cache must succeed");
    await waitForLeaseExpiry();

    const resA = await fetch(`${baseUrl}/api/v1/catalog/products?page=1&limit=2`, {
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: sessionA },
    });
    assert.equal(resA.status, 200, "Products read must succeed over real HTTP");
    assert.equal(
      resA.headers.get("x-consistency-plane"),
      "primary-master",
      "Unavailable replay position must route reads to the primary plane",
    );
    console.log("  ✓ Real HTTP read routed to primary (fail safe) ✓");

    // -------------------------------------------------------------------------
    // Scenario B — injected lag, then recovery, on a live standby stand-in.
    // The stand-in replays the REAL primary WAL clock minus a controlled
    // backlog: exactly what a Chaos-Mesh-frozen standby would report.
    // -------------------------------------------------------------------------
    console.log("\nB. Standby lagging (64KiB backlog) → primary; recovered → replica");

    const sessionB = chaosSessions.lagging;
    const mutationLsnB = await capturePrimaryWalLsn();
    await markReadYourWritesWithLSN(redis.client, sessionB, mutationLsnB, {
      lsnTtlMs: SESSION_TTL_MS,
    });

    await waitForLeaseExpiry();

    const queryLaggingStandby = capturePrimaryWalLsn;
    replicaWal.getLsn = async () => {
      // Stand-in standby: reports a replay position frozen behind the
      // primary by FALLBACK_LAG_BYTES (Chaos Mesh replay-freeze equivalent).
      const current = await queryLaggingStandby();
      return lsnToString(safeSub(parseLSN(current), FALLBACK_LAG_BYTES));
    };

    const resB1 = await fetch(`${baseUrl}/api/v1/catalog/products?page=1&limit=2`, {
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: sessionB },
    });
    assert.equal(resB1.status, 200);
    assert.equal(
      resB1.headers.get("x-consistency-plane"),
      "primary-master",
      "Lagging standby must force the primary plane",
    );
    console.log("  ✓ Injected 64KiB replay backlog forces primary failover ✓");

    // Recovery: standby has fully caught up with the primary's WAL clock.
    const sessionB2 = chaosSessions.recovered;
    const mutationLsnB2 = await capturePrimaryWalLsn();
    await markReadYourWritesWithLSN(redis.client, sessionB2, mutationLsnB2, {
      lsnTtlMs: SESSION_TTL_MS,
    });
    replicaWal.getLsn = capturePrimaryWalLsn; // Fully-replayed standby position
    await waitForLeaseExpiry();

    const resB2 = await fetch(`${baseUrl}/api/v1/catalog/products?page=1&limit=2`, {
      headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: sessionB2 },
    });
    assert.equal(resB2.status, 200);
    assert.equal(
      resB2.headers.get("x-consistency-plane"),
      null,
      "Recovered standby must drop the primary telemetry header",
    );
    console.log("  ✓ Recovery returns browsing traffic to the replica plane ✓");

    // -------------------------------------------------------------------------
    // Scenario C — innocent browser with no mutation history stays on replica
    // -------------------------------------------------------------------------
    console.log("\nC. No mutation history → baseline replica plane preserved");

    const resC = await fetch(`${baseUrl}/api/v1/catalog/products?page=1&limit=2`);
    assert.equal(resC.status, 200);
    assert.equal(
      resC.headers.get("x-consistency-plane"),
      null,
      "Requests without a session LSN/replay contention must not hit primary",
    );
    console.log("  ✓ Baseline browsing unaffected by the chaos experiment ✓");

    // -------------------------------------------------------------------------
    // Scenario D — SAME-AS-PROD 11.11 flash-sale CHECKOUT under injected lag:
    // convergent checkout WRITES (real PostgreSQL WAL mutations — the exact
    // path that emits x-db-lsn) racing concurrent buyer reads AND pure
    // bystander browsing, all over real HTTP while the standby lags.
    // Verifies (1) each buyer's own reads fail over to primary, (2)
    // bystanders without checkout history stay on the replica despite the
    // lag, and (3) full recovery returns everyone to the replica plane.
    // -------------------------------------------------------------------------
    console.log(
      "\nD. Flash-sale checkout storm (mixed write/read traffic) under injected lag",
    );

    // Real WAL-generating scratch surface modeling a checkout write
    // (e.g. inventory reservation) from the PostgreSQL-backed writers.
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS _chaos_flash_scratch (
         id bigserial PRIMARY KEY,
         payload text NOT NULL,
         created_at timestamptz NOT NULL DEFAULT now())`,
    );

    // Re-freeze the standby 64KiB behind the primary (lag injection active).
    const queryFlashLagStandby = capturePrimaryWalLsn;
    replicaWal.getLsn = async () =>
      lsnToString(safeSub(parseLSN(await queryFlashLagStandby()), FALLBACK_LAG_BYTES));

    const BUYER_COUNT = 4;
    const buyerSessions = Array.from(
      { length: BUYER_COUNT },
      (_, i) => `chaos_e2e_flash_buyer_${i + 1}`,
    );
    flashBuyerSessions.push(...buyerSessions);

    // Phase 1 — checkout storm: each buyer's checkout WRITE (real insert →
    // WAL advance → gateway-equivalent LSN sticky) races its own immediate
    // read and pure bystander browsing, all concurrently.
    const storm = buyerSessions.map(async (buyer, i) => {
      await prisma.$executeRaw`INSERT INTO _chaos_flash_scratch (payload)
         VALUES (${`flash-sale-checkout-buyer-${i + 1}`})`;
      const lsn = await capturePrimaryWalLsn();
      const marked = await markReadYourWritesWithLSN(redis.client, buyer, lsn, {
        lsnTtlMs: SESSION_TTL_MS,
      });
      assert.equal(marked, true, `LSN mark must succeed for ${buyer}`);

      // Immediate post-checkout read: the 500ms time lease forces the
      // primary plane (real production behavior for at-checkout reads).
      const resImmediate = await fetch(
        `${baseUrl}/api/v1/catalog/products?page=1&limit=2`,
        { headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: buyer } },
      );
      assert.equal(resImmediate.status, 200);
      assert.equal(
        resImmediate.headers.get("x-consistency-plane"),
        "primary-master",
        `At-checkout read for ${buyer} must ride the 500ms time lease onto primary`,
      );
      return `${buyer} checkout ✓`;
    });
    const bystander = async () => {
      const res = await fetch(
        `${baseUrl}/api/v1/catalog/products?page=1&limit=2`,
      );
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get("x-consistency-plane"),
        null,
        "Bystanders without checkout history must stay on the replica plane while the standby lags",
      );
      return "bystander replica-browsing ✓";
    };
    const stormRounds = await Promise.all([...storm, bystander(), bystander()]);
    for (const line of stormRounds) console.log(`  • ${line}`);

    // Phase 2 — post-storm reads beyond the 500ms time lease: the LSN guard
    // alone must keep each lagging-buyer session pinned onto primary.
    await waitForLeaseExpiry();
    const postLeaseReads = await Promise.all(
      buyerSessions.map(async (buyer) => {
        const res = await fetch(
          `${baseUrl}/api/v1/catalog/products?page=1&limit=2`,
          { headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: buyer } },
        );
        assert.equal(res.status, 200);
        assert.equal(
          res.headers.get("x-consistency-plane"),
          "primary-master",
          `Post-lease read for ${buyer} must stay on primary via the LSN guard while standby lags`,
        );
        return `${buyer} post-lease LSN-guard routing ✓`;
      }),
    );
    for (const line of postLeaseReads) console.log(`  • ${line}`);

    // Phase 3 — replication lag clears (standby fully caught up): every
    // checkpointed session returns to the replica plane without anything
    // having to eventually hit the primary again.
    replicaWal.getLsn = capturePrimaryWalLsn;
    await waitForLeaseExpiry();
    for (const buyer of buyerSessions) {
      const res = await fetch(
        `${baseUrl}/api/v1/catalog/products?page=1&limit=2`,
        { headers: { [GATEWAY_HEADERS.CLIENT_SESSION_ID]: buyer } },
      );
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get("x-consistency-plane"),
        null,
        `Once the standby replays past ${buyer}'s LSN, reads must return to the replica plane`,
      );
    }
    console.log("  ✓ Lag cleared — all buyers back on the replica plane ✓");

    console.log("  ✓ Mixed-traffic flash-sale chaos scenario complete ✓");
  } finally {
    replicaWal.getLsn = originalGetLsn;
    // Cleanup gateway-contract session state from the live Redis
    const straySessions = Object.values(chaosSessions).concat(flashBuyerSessions);
    for (const session of straySessions) {
      await redis.client.del(
        buildReadYourWritesLsnKey(session),
        `ryw:${session}`,
      );
    }
    // Drop the WAL-mutation scratch surface created for the checkout storm
    await prisma.$executeRawUnsafe(
      `DROP TABLE IF EXISTS _chaos_flash_scratch`,
    );
    await app.close();
  }

  console.log("\n==================================================");
  console.log("🎉 Replication-lag failover chaos e2e passed cleanly!");
  console.log("==================================================");
}

runChaosE2e()
  .then(() => {
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error("❌ Replication-lag chaos e2e failed:", err);
    process.exit(1);
  });
