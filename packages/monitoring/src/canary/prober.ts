/**
 * Core Synthetic Canary Prober Engine.
 *
 * Executes real-world user simulation loops (Fast Reads & Full Checkout) with
 * high-resolution step latency measurement, synthetic header isolation, and
 * SLA metric aggregation.
 */

import crypto from "node:crypto";
import type {
  CanaryScenarioType,
  CanaryStepResult,
  CanaryProbeRun,
  CanaryProbeOptions,
  CanarySlaStats,
  CanaryStorageAdapter,
} from "./types.js";

export const SYNTHETIC_PROBE_HEADER = "x-synthetic-probe";
export const CANARY_SKU_ID = 99901;
export const CANARY_VARIANT_ID = "var_canary_01";
export const CANARY_USER_ID = "usr_synthetic_canary_daemon";

export class InMemoryCanaryStorage implements CanaryStorageAdapter {
  private runs: CanaryProbeRun[] = [];
  private consecutiveFailures: Record<CanaryScenarioType, number> = {
    read: 0,
    checkout: 0,
  };

  async pushRun(run: CanaryProbeRun): Promise<void> {
    this.runs.unshift(run);
    if (this.runs.length > 200) {
      this.runs.pop();
    }

    if (run.success) {
      this.consecutiveFailures[run.scenario] = 0;
    } else {
      this.consecutiveFailures[run.scenario] =
        (this.consecutiveFailures[run.scenario] ?? 0) + 1;
    }
  }

  async getRuns(
    scenario?: CanaryScenarioType,
    limit = 50,
  ): Promise<CanaryProbeRun[]> {
    let filtered = this.runs;
    if (scenario) {
      filtered = filtered.filter((r) => r.scenario === scenario);
    }
    return filtered.slice(0, limit);
  }

  async getConsecutiveFailures(scenario: CanaryScenarioType): Promise<number> {
    return this.consecutiveFailures[scenario] ?? 0;
  }
}

export class CanaryProber {
  private storage: CanaryStorageAdapter;
  private consecutiveFailures: Record<CanaryScenarioType, number> = {
    read: 0,
    checkout: 0,
  };

  constructor(storage?: CanaryStorageAdapter) {
    this.storage = storage ?? new InMemoryCanaryStorage();
  }

  private async executeStep<T = any>(
    stepName: string,
    action: () => Promise<{
      httpStatus?: number;
      metadata?: Record<string, unknown>;
    } | void>,
  ): Promise<CanaryStepResult> {
    const start = performance.now();
    try {
      const res = await action();
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        step: stepName,
        durationMs,
        success: true,
        httpStatus:
          res && typeof res === "object" ? (res.httpStatus ?? 200) : 200,
        metadata: res && typeof res === "object" ? res.metadata : undefined,
      };
    } catch (err: any) {
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      return {
        step: stepName,
        durationMs,
        success: false,
        httpStatus: err.status ?? err.statusCode ?? 500,
        error: err.message || String(err),
      };
    }
  }

  /**
   * Fast Read Scenario (Home Aggregation + Product Search + Edge Stock Cache)
   */
  public async runReadProbe(
    baseUrl: string,
    options?: CanaryProbeOptions,
  ): Promise<CanaryProbeRun> {
    const runId = `canary-read-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const fetchImpl = options?.fetchFn ?? fetch;
    const baseHeaders: Record<string, string> = {
      [SYNTHETIC_PROBE_HEADER]: "true",
      "x-request-id": runId,
      ...(options?.headers ?? {}),
    };

    const steps: CanaryStepResult[] = [];

    // Step 1: Home Aggregation
    const step1 = await this.executeStep("1. Home Aggregation", async () => {
      const res = await fetchImpl(`${baseUrl}/api/v1/home`, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
      });
      if (!res.ok) {
        throw new Error(`Home aggregation failed with HTTP ${res.status}`);
      }
      return { httpStatus: res.status };
    });
    steps.push(step1);

    // Step 2: Product Search Query
    if (step1.success) {
      const step2 = await this.executeStep("2. OpenSearch Query", async () => {
        const res = await fetchImpl(
          `${baseUrl}/api/v1/catalog/products?q=canary`,
          {
            headers: baseHeaders,
            signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
          },
        );
        if (!res.ok) {
          throw new Error(`Product search failed with HTTP ${res.status}`);
        }
        return { httpStatus: res.status };
      });
      steps.push(step2);
    }

    // Step 3: Edge Stock Cache Query
    if (steps.every((s) => s.success)) {
      const step3 = await this.executeStep("3. Edge Stock Cache", async () => {
        const res = await fetchImpl(
          `${baseUrl}/api/v1/inventory/${CANARY_SKU_ID}/availability`,
          {
            headers: baseHeaders,
            signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
          },
        );
        if (!res.ok && res.status !== 404) {
          throw new Error(`Stock query failed with HTTP ${res.status}`);
        }
        return { httpStatus: res.status };
      });
      steps.push(step3);
    }

    const overallSuccess = steps.length === 3 && steps.every((s) => s.success);
    const completedAt = new Date().toISOString();
    const totalDurationMs = steps.reduce((acc, s) => acc + s.durationMs, 0);

    if (overallSuccess) {
      this.consecutiveFailures.read = 0;
    } else {
      this.consecutiveFailures.read += 1;
    }

    const run: CanaryProbeRun = {
      runId,
      scenario: "read",
      startedAt,
      completedAt,
      totalDurationMs: Math.round(totalDurationMs * 100) / 100,
      success: overallSuccess,
      steps,
      error: steps.find((s) => !s.success)?.error,
      consecutiveFailures: this.consecutiveFailures.read,
    };

    await this.storage.pushRun(run);
    return run;
  }

  /**
   * Transactional Checkout Scenario (Stock Check -> Reservation -> Order Draft -> Auto-Cleanup)
   */
  public async runCheckoutProbe(
    baseUrl: string,
    options?: CanaryProbeOptions,
  ): Promise<CanaryProbeRun> {
    const runId = `canary-chk-${crypto.randomUUID().slice(0, 8)}`;
    const startedAt = new Date().toISOString();
    const fetchImpl = options?.fetchFn ?? fetch;
    const baseHeaders: Record<string, string> = {
      [SYNTHETIC_PROBE_HEADER]: "true",
      "x-request-id": runId,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    };

    const steps: CanaryStepResult[] = [];
    let reservationReferenceId = "";

    // Step 1: Check Availability
    const step1 = await this.executeStep(
      "1. Query Stock Availability",
      async () => {
        const res = await fetchImpl(
          `${baseUrl}/api/v1/inventory/${CANARY_SKU_ID}/availability`,
          {
            headers: baseHeaders,
            signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
          },
        );
        if (!res.ok && res.status !== 404) {
          throw new Error(
            `Stock availability check returned HTTP ${res.status}`,
          );
        }
        return { httpStatus: res.status };
      },
    );
    steps.push(step1);

    // Step 2: Atomic Checkout Reservation
    if (step1.success) {
      reservationReferenceId = `ref_canary_${Date.now()}`;
      const step2 = await this.executeStep(
        "2. Reserve Stock Fast-Path",
        async () => {
          const res = await fetchImpl(
            `${baseUrl}/api/v1/inventory/reservations`,
            {
              method: "POST",
              headers: baseHeaders,
              body: JSON.stringify({
                items: [
                  {
                    productId: CANARY_SKU_ID,
                    variantId: CANARY_VARIANT_ID,
                    quantity: 1,
                    warehouseId: "pk_khi_01",
                  },
                ],
                referenceId: reservationReferenceId,
                expiresInSeconds: 300,
              }),
              signal: AbortSignal.timeout(options?.timeoutMs ?? 4000),
            },
          );

          // Fast-path can return 202 Accepted, 201 Created, or 409 If Insufficient in Mock
          if (!res.ok && res.status !== 202 && res.status !== 201) {
            throw new Error(`Stock reservation failed with HTTP ${res.status}`);
          }
          return {
            httpStatus: res.status,
            metadata: { referenceId: reservationReferenceId },
          };
        },
      );
      steps.push(step2);
    }

    // Step 3: Order Placement Simulation
    if (steps.every((s) => s.success)) {
      const step3 = await this.executeStep(
        "3. Create Draft Order",
        async () => {
          const res = await fetchImpl(`${baseUrl}/api/v1/orders/cod`, {
            method: "POST",
            headers: baseHeaders,
            body: JSON.stringify({
              userId: CANARY_USER_ID,
              items: [
                {
                  productId: CANARY_SKU_ID,
                  variantId: CANARY_VARIANT_ID,
                  quantity: 1,
                  price: 10,
                },
              ],
              shippingAddress: {
                street: "Canary Probe Way 101",
                city: "Karachi",
                country: "PK",
              },
              idempotencyKey: `idemp_${runId}`,
            }),
            signal: AbortSignal.timeout(options?.timeoutMs ?? 5000),
          });

          if (!res.ok && res.status !== 201 && res.status !== 200) {
            throw new Error(
              `Order placement simulation failed with HTTP ${res.status}`,
            );
          }
          return { httpStatus: res.status };
        },
      );
      steps.push(step3);
    }

    // Step 4: Auto-Cleanup Compensation (Release Reservation)
    if (reservationReferenceId) {
      const step4 = await this.executeStep(
        "4. Auto-Cleanup Compensation",
        async () => {
          const res = await fetchImpl(
            `${baseUrl}/api/v1/inventory/reservations/${reservationReferenceId}`,
            {
              method: "DELETE",
              headers: baseHeaders,
              signal: AbortSignal.timeout(options?.timeoutMs ?? 3000),
            },
          );
          return { httpStatus: res.status };
        },
      );
      steps.push(step4);
    }

    const overallSuccess =
      steps.length >= 3 && steps.slice(0, 3).every((s) => s.success);
    const completedAt = new Date().toISOString();
    const totalDurationMs = steps.reduce((acc, s) => acc + s.durationMs, 0);

    if (overallSuccess) {
      this.consecutiveFailures.checkout = 0;
    } else {
      this.consecutiveFailures.checkout += 1;
    }

    const run: CanaryProbeRun = {
      runId,
      scenario: "checkout",
      startedAt,
      completedAt,
      totalDurationMs: Math.round(totalDurationMs * 100) / 100,
      success: overallSuccess,
      steps,
      error: steps.find((s) => !s.success)?.error,
      consecutiveFailures: this.consecutiveFailures.checkout,
    };

    await this.storage.pushRun(run);
    return run;
  }

  /**
   * Retrieves recent runs from storage
   */
  public async getRecentRuns(
    scenario?: CanaryScenarioType,
    limit = 50,
  ): Promise<CanaryProbeRun[]> {
    return this.storage.getRuns(scenario, limit);
  }

  /**
   * Computes SLA Statistics across history
   */
  public async calculateSla(
    scenario: CanaryScenarioType,
  ): Promise<CanarySlaStats> {
    const runs = await this.storage.getRuns(scenario, 200);
    const totalRuns = runs.length;
    if (totalRuns === 0) {
      return {
        scenario,
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        slaPercentage: 100,
        avgDurationMs: 0,
        p95DurationMs: 0,
        consecutiveFailures: 0,
      };
    }

    const successfulRuns = runs.filter((r) => r.success).length;
    const failedRuns = totalRuns - successfulRuns;
    const slaPercentage =
      Math.round((successfulRuns / totalRuns) * 10000) / 100;

    const durations = runs.map((r) => r.totalDurationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const avgDurationMs = Math.round((sum / totalRuns) * 100) / 100;

    const p95Index = Math.min(
      durations.length - 1,
      Math.floor(durations.length * 0.95),
    );
    const p95DurationMs = durations[p95Index] ?? 0;

    const lastRun = runs[0];
    const consecutiveFailures =
      await this.storage.getConsecutiveFailures(scenario);

    return {
      scenario,
      totalRuns,
      successfulRuns,
      failedRuns,
      slaPercentage,
      avgDurationMs,
      p95DurationMs,
      consecutiveFailures,
      lastRunAt: lastRun?.startedAt,
      lastRunStatus: lastRun?.success ? "success" : "failure",
    };
  }
}
