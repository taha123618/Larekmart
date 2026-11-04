/**
 * fraud.service.ts — Admin service for managing fraud cases, analyst decisions, and risk scoring rules.
 */

import type {
  FraudCase,
  FraudRule,
  FraudCaseStatus,
  FraudCasePriority,
  AssessmentWorkflow,
  AnalystDecision,
  CreateFraudRule,
  FraudDecision,
  RiskModelVersion,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const ADMIN_FRAUD_BASE = `${API_BASE}/api/v1/admin/fraud`;

function getHeaders(authToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface FetchCasesParams {
  status?: FraudCaseStatus | string;
  priority?: FraudCasePriority | string;
  limit?: number;
  offset?: number;
}

/**
 * Fetch all investigation cases with optional status or priority filtering
 */
export async function fetchAdminFraudCases(
  params?: FetchCasesParams,
  authToken?: string | null,
): Promise<FraudCase[]> {
  const searchParams = new URLSearchParams();
  if (params?.status && params.status !== "ALL") {
    searchParams.set("status", params.status);
  }
  if (params?.priority && params.priority !== "ALL") {
    searchParams.set("priority", params.priority);
  }
  if (params?.limit) {
    searchParams.set("limit", String(params.limit));
  }
  if (params?.offset) {
    searchParams.set("offset", String(params.offset));
  }

  const queryString = searchParams.toString();
  const url = queryString
    ? `${ADMIN_FRAUD_BASE}/cases?${queryString}`
    : `${ADMIN_FRAUD_BASE}/cases`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch fraud cases (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch active fraud scoring and detection rules
 */
export async function fetchAdminFraudRules(
  workflow?: AssessmentWorkflow | string,
  authToken?: string | null,
): Promise<FraudRule[]> {
  const url =
    workflow && workflow !== "ALL"
      ? `${ADMIN_FRAUD_BASE}/rules?workflow=${workflow}`
      : `${ADMIN_FRAUD_BASE}/rules`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch fraud rules (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Submit analyst resolution for an open fraud case
 */
export async function reviewAdminFraudCase(
  caseId: string,
  payload: {
    decision: AnalystDecision;
    notes: string;
    analystId?: string;
    overridePrevious?: boolean;
  },
  authToken?: string | null,
): Promise<{
  caseId: string;
  status: string;
  decision: string;
  analystId: string;
  notes: string;
  resolvedAt: string;
}> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/cases/${caseId}/review`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({
      decision: payload.decision,
      notes: payload.notes,
      analystId: payload.analystId || "admin-analyst",
      overridePrevious: payload.overridePrevious ?? false,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to review fraud case (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new configurable fraud rule
 */
export async function createAdminFraudRule(
  rule: CreateFraudRule,
  authToken?: string | null,
): Promise<FraudRule> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/rules`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(rule),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create fraud rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch full chronological audit trail of analyst decisions for a specific fraud case
 */
export async function fetchAdminFraudCaseDecisions(
  caseId: string,
  authToken?: string | null,
): Promise<FraudDecision[]> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/cases/${caseId}/decisions`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch fraud case decisions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

export interface FraudPerformanceMetrics {
  totalAssessments: number;
  totalCases: number;
  totalResolvedCases: number;
  confirmedFraudCases: number;
  falsePositiveCases: number;
  falsePositiveRate: number;
  trueBlockRate: number;
  averageLatencyMs: number;
  rulePerformance: Array<{
    ruleCode: string;
    totalTriggers: number;
    confirmedFraud: number;
    falsePositives: number;
    accuracyRate: number;
  }>;
}

/**
 * Fetch performance metrics, accuracy rates, and false-positive tracking
 */
export async function fetchAdminFraudPerformance(
  authToken?: string | null,
): Promise<FraudPerformanceMetrics> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/performance`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch fraud performance metrics (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch list of trained anomaly detection models and versions
 */
export async function fetchAdminFraudModels(
  authToken?: string | null,
): Promise<RiskModelVersion[]> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/models`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch fraud model versions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Trigger live retraining of scikit-learn IsolationForest anomaly model
 */
export async function retrainAdminFraudModel(
  payload: {
    modelName?: string;
    nEstimators?: number;
    contamination?: number;
  },
  authToken?: string | null,
): Promise<RiskModelVersion> {
  const res = await fetch(`${ADMIN_FRAUD_BASE}/models/retrain`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify({
      modelName: payload.modelName || "isolation_forest_v1",
      nEstimators: payload.nEstimators ?? 50,
      contamination: payload.contamination ?? 0.05,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to retrain fraud model (HTTP ${res.status})`,
    );
  }

  return res.json();
}


