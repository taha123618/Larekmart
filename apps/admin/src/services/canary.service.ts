/**
 * canary.service.ts — Admin service for Automated Synthetic Canary & E2E Health Prober.
 * Interacts with API Gateway admin endpoints to fetch probe histories, SLA metrics,
 * and trigger on-demand synthetic checks.
 */

import { getApiGatewayUrl } from "./gateway.service";
import type {
  CanaryScenarioType,
  CanaryProbeRun,
  CanarySlaStats,
} from "@repo/monitoring";

export interface CanarySlaResponse {
  read: CanarySlaStats;
  checkout: CanarySlaStats;
}

export interface CanaryRunsResponse {
  count: number;
  data: CanaryProbeRun[];
}

const getAdminCanaryBase = (): string => {
  const apiBase = getApiGatewayUrl();
  return `${apiBase}/api/v1/admin/canary`;
};

function getHeaders(authToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export async function fetchCanaryRuns(
  authToken?: string | null,
  options?: { scenario?: CanaryScenarioType; limit?: number },
): Promise<CanaryProbeRun[]> {
  const base = getAdminCanaryBase();
  const params = new URLSearchParams();
  if (options?.scenario) params.set("scenario", options.scenario);
  if (options?.limit) params.set("limit", String(options.limit));

  const url = `${base}/runs${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch canary runs: HTTP ${res.status}`,
    );
  }

  const json = await res.json();
  return json.data || [];
}

export async function fetchCanarySla(
  authToken?: string | null,
): Promise<CanarySlaResponse> {
  const base = getAdminCanaryBase();
  const res = await fetch(`${base}/sla`, {
    method: "GET",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch canary SLA: HTTP ${res.status}`,
    );
  }

  const json = await res.json();
  return json.data;
}

export async function triggerCanaryProbe(
  authToken: string | null | undefined,
  scenario: CanaryScenarioType,
): Promise<CanaryProbeRun> {
  const base = getAdminCanaryBase();
  const res = await fetch(`${base}/trigger`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({ scenario }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to trigger canary probe: HTTP ${res.status}`,
    );
  }

  const json = await res.json();
  return json.data;
}
