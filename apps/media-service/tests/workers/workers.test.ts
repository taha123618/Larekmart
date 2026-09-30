import assert from "node:assert/strict";
import { runCleanupSweep } from "../../src/workers/cleanup.worker.js";
import { setServiceContainerForTests } from "../../src/container.js";

export async function runWorkerTests(): Promise<void> {
  console.log("--- Worker Lifecycle Tests ---");

  const now = Date.now();
  const deletedObjects: string[] = [];
  const uploadRows = [
    { id: "up_exp", status: "PENDING", expiresAt: new Date(now - 1000) },
    { id: "up_active", status: "PENDING", expiresAt: new Date(now + 60000) },
  ];
  const jobRows = [
    {
      id: "job_stale",
      status: "PROCESSING",
      startedAt: new Date(now - 1000000),
    },
    { id: "job_fresh", status: "PROCESSING", startedAt: new Date(now - 1000) },
  ];
  const mediaRows = [
    {
      id: "med_abandoned",
      status: "PENDING",
      createdAt: new Date(now - 90000000),
      deletedAt: null,
      objectKey: "p/1/m/orig.jpg",
    },
    {
      id: "med_deleted_old",
      status: "DELETED",
      createdAt: new Date(now - 800000000),
      deletedAt: new Date(now - 700000000), // > 7 days ago
      objectKey: "p/1/old/orig.jpg",
    },
  ];

  const fakeContainer = {
    storage: {
      deleteObject: async (key: string) => {
        deletedObjects.push(key);
      },
      exists: async () => true,
    },
    repos: {
      uploads: {
        listExpiredPending: async (d: Date) =>
          uploadRows.filter((r) => r.status === "PENDING" && r.expiresAt < d),
        markExpired: async (id: string) => {
          const r = uploadRows.find((u) => u.id === id);
          if (r) r.status = "EXPIRED";
        },
      },
      jobs: {
        requeueStaleProcessing: async (staleBefore: Date) => {
          let c = 0;
          for (const j of jobRows) {
            if (
              j.status === "PROCESSING" &&
              j.startedAt &&
              j.startedAt < staleBefore
            ) {
              j.status = "PENDING";
              c += 1;
            }
          }
          return c;
        },
      },
      media: {
        listByStatusOlderThan: async (statuses: string[], olderThan: Date) =>
          mediaRows.filter(
            (r) =>
              r.deletedAt === null &&
              statuses.includes(r.status) &&
              r.createdAt < olderThan,
          ),
        updateStatus: async (id: string, s: string) => {
          const r = mediaRows.find((m) => m.id === id);
          if (r) r.status = s;
          return r as never;
        },
        listSoftDeletedOlderThan: async (olderThan: Date) =>
          mediaRows.filter(
            (r) => r.deletedAt !== null && r.deletedAt < olderThan,
          ),
        hardDelete: async (id: string) => {
          const idx = mediaRows.findIndex((m) => m.id === id);
          if (idx >= 0) mediaRows.splice(idx, 1);
        },
      },
      variants: {
        listByMediaId: async () => [],
        deleteForMedia: async () => undefined,
      },
    },
  };

  try {
    setServiceContainerForTests(fakeContainer as never);

    const result = await runCleanupSweep();
    assert.equal(result.expiredSessions, 1);
    assert.equal(uploadRows.find((r) => r.id === "up_exp")?.status, "EXPIRED");
    assert.equal(
      uploadRows.find((r) => r.id === "up_active")?.status,
      "PENDING",
    );
    assert.equal(result.requeuedJobs, 1);
    assert.equal(jobRows.find((r) => r.id === "job_stale")?.status, "PENDING");
    assert.equal(
      jobRows.find((r) => r.id === "job_fresh")?.status,
      "PROCESSING",
    );
    assert.equal(result.expiredMediaMarked, 1);
    assert.equal(result.purgedMedia, 1);
  } finally {
    setServiceContainerForTests(null);
  }

  console.log("✓ Worker lifecycle tests passed\n");
}
