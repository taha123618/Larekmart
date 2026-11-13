/**
 * Types and contracts for Automated Synthetic Canary & E2E Health Prober.
 */

export type CanaryScenarioType = "read" | "checkout";

export interface CanaryStepResult {
  step: string;
  durationMs: number;
  success: boolean;
  httpStatus?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CanaryProbeRun {
  runId: string;
  scenario: CanaryScenarioType;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  success: boolean;
  steps: CanaryStepResult[];
  error?: string;
  consecutiveFailures: number;
}

export interface CanarySlaStats {
  scenario: CanaryScenarioType;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  slaPercentage: number;
  avgDurationMs: number;
  p95DurationMs: number;
  consecutiveFailures: number;
  lastRunAt?: string;
  lastRunStatus?: "success" | "failure";
}

export interface CanaryProbeOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface CanaryStorageAdapter {
  pushRun(run: CanaryProbeRun): Promise<void>;
  getRuns(
    scenario?: CanaryScenarioType,
    limit?: number,
  ): Promise<CanaryProbeRun[]>;
  getConsecutiveFailures(scenario: CanaryScenarioType): Promise<number>;
}
