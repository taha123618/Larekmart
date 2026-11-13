/**
 * feature-flags.service.ts — Admin service for managing dynamic feature flags,
 * canary rollouts, attribute targeting, and runtime evaluations via API Gateway.
 */

import { getApiGatewayUrl } from "./gateway.service";

const getAdminFeatureFlagsBase = (): string => {
  const apiBase = getApiGatewayUrl();
  return `${apiBase}/api/v1/admin/feature-flags`;
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

export type RuleOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "regex"
  | "greater_than"
  | "less_than";

export interface FeatureFlagRule {
  id: string;
  attribute: string;
  operator: RuleOperator;
  values: (string | number | boolean)[];
  variation?: string;
  value?: any;
}

export interface FeatureFlagRollout {
  percentage: number;
  stickinessAttribute?: string;
  trueVariation?: string;
  falseVariation?: string;
}

export interface FeatureFlagDefinition {
  key: string;
  enabled: boolean;
  defaultValue: any;
  variations?: Record<string, any>;
  defaultVariation?: string;
  disabledVariation?: string;
  rules?: FeatureFlagRule[];
  rollout?: FeatureFlagRollout;
  description?: string;
  version?: number;
  updatedAt?: string;
}

export interface EvaluationContext {
  targetingKey?: string;
  attributes?: Record<string, string | number | boolean | string[] | undefined | null>;
}

export type EvaluationReason =
  | "DISABLED"
  | "STATIC"
  | "TARGETING_MATCH"
  | "PERCENTAGE_ROLLOUT"
  | "DEFAULT"
  | "ERROR";

export interface EvaluationResult {
  value: any;
  variant?: string;
  reason: EvaluationReason;
  flagKey: string;
}

/**
 * Fetch all feature flags from the API Gateway
 */
export async function fetchAdminFeatureFlags(
  getToken: () => Promise<string | null>,
): Promise<FeatureFlagDefinition[]> {
  const token = await getToken();
  const res = await fetch(getAdminFeatureFlagsBase(), {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch feature flags (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data || [];
}

/**
 * Fetch a single feature flag definition
 */
export async function fetchAdminFeatureFlag(
  key: string,
  getToken: () => Promise<string | null>,
): Promise<FeatureFlagDefinition> {
  const token = await getToken();
  const res = await fetch(`${getAdminFeatureFlagsBase()}/${encodeURIComponent(key)}`, {
    headers: getHeaders(token),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch feature flag ${key} (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Create or update a feature flag
 */
export async function saveAdminFeatureFlag(
  flag: FeatureFlagDefinition,
  getToken: () => Promise<string | null>,
): Promise<FeatureFlagDefinition> {
  const token = await getToken();
  const res = await fetch(getAdminFeatureFlagsBase(), {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify(flag),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to save feature flag (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}

/**
 * Toggle feature flag enabled state
 */
export async function toggleAdminFeatureFlag(
  key: string,
  enabled: boolean,
  getToken: () => Promise<string | null>,
): Promise<boolean> {
  const token = await getToken();
  const res = await fetch(
    `${getAdminFeatureFlagsBase()}/${encodeURIComponent(key)}/toggle`,
    {
      method: "PATCH",
      headers: getHeaders(token),
      body: JSON.stringify({ enabled }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to toggle feature flag (${res.status})`,
    );
  }

  return true;
}

/**
 * Update rollout percentage for canary releases
 */
export async function updateAdminFeatureFlagRollout(
  key: string,
  percentage: number,
  getToken: () => Promise<string | null>,
): Promise<boolean> {
  const token = await getToken();
  const res = await fetch(
    `${getAdminFeatureFlagsBase()}/${encodeURIComponent(key)}/rollout`,
    {
      method: "PATCH",
      headers: getHeaders(token),
      body: JSON.stringify({ percentage }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to update rollout percentage (${res.status})`,
    );
  }

  return true;
}

/**
 * Delete a feature flag
 */
export async function deleteAdminFeatureFlag(
  key: string,
  getToken: () => Promise<string | null>,
): Promise<boolean> {
  const token = await getToken();
  const res = await fetch(
    `${getAdminFeatureFlagsBase()}/${encodeURIComponent(key)}`,
    {
      method: "DELETE",
      headers: getHeaders(token),
    },
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to delete feature flag (${res.status})`,
    );
  }

  return true;
}

/**
 * Simulate feature flag evaluation for testing
 */
export async function evaluateAdminFeatureFlag(
  key: string,
  context: EvaluationContext,
  defaultValue: any,
  getToken: () => Promise<string | null>,
): Promise<EvaluationResult> {
  const token = await getToken();
  const res = await fetch(
    `${getAdminFeatureFlagsBase()}/${encodeURIComponent(key)}/evaluate`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ context, defaultValue }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to evaluate feature flag (${res.status})`,
    );
  }

  const json = await res.json();
  return json.data;
}
