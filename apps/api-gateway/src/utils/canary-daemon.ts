/**
 * Background Daemon for Automated Synthetic Canary & E2E Health Probes.
 */

import {
  CanaryProber,
  type CanaryScenarioType,
  type CanaryProbeRun,
} from "@repo/monitoring";
import { redis } from "./redis.js";
import { RedisCanaryStorage } from "./canary-storage.js";
import { logger } from "../observability/logger.js";
import {
  canaryProbeRunsTotal,
  canaryProbeDurationSeconds,
  canaryProbeConsecutiveFailures,
  canaryProbeSlaPercentage,
} from "../observability/metrics.js";

const storage = new RedisCanaryStorage(redis.client);
export const canaryProber = new CanaryProber(storage);

let readTimer: NodeJS.Timeout | null = null;
let checkoutTimer: NodeJS.Timeout | null = null;
let isRunning = false;

function recordRunMetrics(run: CanaryProbeRun): void {
  const status = run.success ? "success" : "failure";
  canaryProbeRunsTotal.inc({ scenario: run.scenario, status });
  canaryProbeDurationSeconds.observe(
    { scenario: run.scenario, status },
    run.totalDurationMs / 1000,
  );
  canaryProbeConsecutiveFailures.set(run.consecutiveFailures, {
    scenario: run.scenario,
  });
}

export async function executeCanaryScenario(
  scenario: CanaryScenarioType,
  gatewayUrl = "http://localhost:8080",
): Promise<CanaryProbeRun> {
  let run: CanaryProbeRun;
  if (scenario === "read") {
    run = await canaryProber.runReadProbe(gatewayUrl);
  } else {
    run = await canaryProber.runCheckoutProbe(gatewayUrl);
  }

  recordRunMetrics(run);

  // Recalculate and update SLA gauge
  try {
    const sla = await canaryProber.calculateSla(scenario);
    canaryProbeSlaPercentage.set(sla.slaPercentage, { scenario });
  } catch {}

  if (!run.success) {
    logger.warn(`Synthetic canary ${scenario} probe failed!`, {
      runId: run.runId,
      scenario: run.scenario,
      durationMs: run.totalDurationMs,
      consecutiveFailures: run.consecutiveFailures,
      error: run.error,
    });
  } else {
    logger.debug(`Synthetic canary ${scenario} probe succeeded`, {
      runId: run.runId,
      durationMs: run.totalDurationMs,
    });
  }

  return run;
}

export function startCanaryDaemon(
  gatewayUrl = "http://localhost:8080",
  readIntervalMs = 60_000,
  checkoutIntervalMs = 180_000,
): () => void {
  if (isRunning) return () => {};
  isRunning = true;

  logger.info("Starting Synthetic Canary Health Prober daemon", {
    readIntervalMs,
    checkoutIntervalMs,
  });

  // Fast read probe loop
  readTimer = setInterval(async () => {
    try {
      await executeCanaryScenario("read", gatewayUrl);
    } catch (err: any) {
      logger.error(`Canary read probe uncaught error: ${err.message}`);
    }
  }, readIntervalMs);

  // Transactional checkout probe loop
  checkoutTimer = setInterval(async () => {
    try {
      await executeCanaryScenario("checkout", gatewayUrl);
    } catch (err: any) {
      logger.error(`Canary checkout probe uncaught error: ${err.message}`);
    }
  }, checkoutIntervalMs);

  return stopCanaryDaemon;
}

export function stopCanaryDaemon(): void {
  if (readTimer) {
    clearInterval(readTimer);
    readTimer = null;
  }
  if (checkoutTimer) {
    clearInterval(checkoutTimer);
    checkoutTimer = null;
  }
  isRunning = false;
  logger.info("Stopped Synthetic Canary Health Prober daemon");
}
