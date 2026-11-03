/**
 * commission.service.ts — Admin service for marketplace commission plans, tiered rules, versioning, and fee analytics.
 */

import type {
  CommissionRuleType,
  CommissionScope,
} from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const API_BASE = getApiGatewayUrl();
const ADMIN_COMMISSIONS_BASE = `${API_BASE}/api/v1/admin/commissions`;

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

export interface AdminCommissionPlan {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
  effectiveFrom?: string;
  effectiveTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCommissionRule {
  id: string;
  planId: string;
  ruleType: CommissionRuleType;
  scope: CommissionScope;
  scopeId?: string | null;
  percentageRate: number | string;
  fixedAmount: number | string;
  minCommission?: number | string | null;
  maxCommission?: number | string | null;
  priority: number;
  status: "ACTIVE" | "INACTIVE";
  effectiveFrom?: string;
  effectiveTo?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCommissionRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  ruleSnapshot: Record<string, unknown>;
  changedBy: string;
  changeReason: string;
  validFrom: string;
  validTo?: string | null;
  createdAt: string;
}

export interface AdminCommissionReport {
  summary: {
    totalCommissionRevenue: number;
    totalOrdersProcessed: number;
    activeSellersCount: number;
  };
  sellerBreakdown: Array<{
    sellerId: string;
    grossSubtotal: number;
    commissionCollected: number;
    netPayout: number;
    orderCount: number;
  }>;
}

export interface CreatePlanInput {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface CreateRuleInput {
  planId: string;
  ruleType: CommissionRuleType;
  scope: CommissionScope;
  scopeId?: string | null;
  percentageRate: number;
  fixedAmount: number;
  minCommission?: number | null;
  maxCommission?: number | null;
  priority?: number;
}

export interface UpdateRuleInput {
  percentageRate?: number;
  fixedAmount?: number;
  minCommission?: number | null;
  maxCommission?: number | null;
  priority?: number;
  status?: "ACTIVE" | "INACTIVE";
  changeReason: string;
}

/**
 * Fetch all marketplace commission plans
 */
export async function fetchCommissionPlans(
  authToken?: string,
): Promise<AdminCommissionPlan[]> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/plans`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch commission plans (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new commission plan
 */
export async function createCommissionPlan(
  input: CreatePlanInput,
  authToken?: string,
): Promise<AdminCommissionPlan> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/plans`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create commission plan (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch all commission rules
 */
export async function fetchCommissionRules(
  authToken?: string,
): Promise<AdminCommissionRule[]> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/rules`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch commission rules (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new commission rule
 */
export async function createCommissionRule(
  input: CreateRuleInput,
  authToken?: string,
): Promise<AdminCommissionRule> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/rules`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create commission rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Update an existing rule and record an immutable version snapshot
 */
export async function updateCommissionRule(
  ruleId: string,
  input: UpdateRuleInput,
  authToken?: string,
): Promise<{ ruleId: string; versionArchived: number; status: string }> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/rules/${ruleId}`, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update commission rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch historical rule versions / audit log
 */
export async function fetchCommissionRuleVersions(
  authToken?: string,
): Promise<AdminCommissionRuleVersion[]> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/rule-versions`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch rule versions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch commission revenue, seller fee totals, and order count reports
 */
export async function fetchCommissionReports(
  authToken?: string,
): Promise<AdminCommissionReport> {
  const res = await fetch(`${ADMIN_COMMISSIONS_BASE}/reports`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch commission reports (HTTP ${res.status})`,
    );
  }

  return res.json();
}
