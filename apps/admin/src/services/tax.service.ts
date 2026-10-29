/**
 * tax.service.ts — Admin service for managing tax rules, jurisdictions, categories, exemptions, and audit logs.
 */

import type {
  TaxOverviewResponse,
  TaxRule,
  TaxJurisdiction,
  TaxCategory,
  TaxExemption,
  CreateTaxRuleInput,
  UpdateTaxRuleInput,
  CreateTaxJurisdictionInput,
  CreateTaxCategoryInput,
  CreateTaxExemptionInput,
} from "@repo/types";
import { getServiceUrl } from "./gateway.service";

const TAX_BASE = getServiceUrl(process.env.NEXT_PUBLIC_TAX_SERVICE_URL);

const ADMIN_BASE = `${TAX_BASE}/api/v1/admin/tax`;
const PUBLIC_BASE = `${TAX_BASE}/api/v1/tax`;

function getAuthHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Fetch executive overview KPIs for all tax jurisdictions, rules, and calculations.
 */
export async function fetchAdminTaxOverview(
  authToken?: string,
): Promise<TaxOverviewResponse> {
  const res = await fetch(`${ADMIN_BASE}/overview`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch tax overview (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch all configured tax rules with joined jurisdiction and category details.
 */
export async function fetchAdminTaxRules(
  authToken?: string,
): Promise<TaxRule[]> {
  const res = await fetch(`${ADMIN_BASE}/rules`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch tax rules (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new jurisdiction tax rule.
 */
export async function createAdminTaxRule(
  input: CreateTaxRuleInput,
  authToken?: string,
): Promise<TaxRule> {
  const res = await fetch(`${ADMIN_BASE}/rules`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create tax rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Update an existing tax rule.
 */
export async function updateAdminTaxRule(
  ruleId: string,
  input: UpdateTaxRuleInput,
  authToken?: string,
): Promise<TaxRule> {
  const res = await fetch(`${ADMIN_BASE}/rules/${ruleId}`, {
    method: "PATCH",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update tax rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Activate a tax rule.
 */
export async function activateAdminTaxRule(
  ruleId: string,
  authToken?: string,
): Promise<TaxRule> {
  const res = await fetch(`${ADMIN_BASE}/rules/${ruleId}/activate`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to activate tax rule (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Deactivate a tax rule.
 */
export async function deactivateAdminTaxRule(
  ruleId: string,
  authToken?: string,
): Promise<void> {
  const res = await fetch(`${ADMIN_BASE}/rules/${ruleId}`, {
    method: "DELETE",
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to deactivate tax rule (HTTP ${res.status})`,
    );
  }
}

/**
 * Fetch all tax jurisdictions.
 */
export async function fetchAdminTaxJurisdictions(
  authToken?: string,
): Promise<TaxJurisdiction[]> {
  const res = await fetch(`${PUBLIC_BASE}/jurisdictions`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch jurisdictions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new tax jurisdiction.
 */
export async function createAdminTaxJurisdiction(
  input: CreateTaxJurisdictionInput,
  authToken?: string,
): Promise<TaxJurisdiction> {
  const res = await fetch(`${ADMIN_BASE}/jurisdictions`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create jurisdiction (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch all product tax categories.
 */
export async function fetchAdminTaxCategories(
  authToken?: string,
): Promise<TaxCategory[]> {
  const res = await fetch(`${PUBLIC_BASE}/categories`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch categories (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a new product tax category.
 */
export async function createAdminTaxCategory(
  input: CreateTaxCategoryInput,
  authToken?: string,
): Promise<TaxCategory> {
  const res = await fetch(`${ADMIN_BASE}/categories`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create tax category (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Fetch all customer tax exemptions.
 */
export async function fetchAdminTaxExemptions(
  authToken?: string,
): Promise<TaxExemption[]> {
  const res = await fetch(`${ADMIN_BASE}/exemptions`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to fetch exemptions (HTTP ${res.status})`,
    );
  }

  return res.json();
}

/**
 * Create a customer tax exemption.
 */
export async function createAdminTaxExemption(
  input: CreateTaxExemptionInput,
  authToken?: string,
): Promise<TaxExemption> {
  const res = await fetch(`${ADMIN_BASE}/exemptions`, {
    method: "POST",
    headers: getAuthHeaders(authToken),
    body: JSON.stringify(input),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to create tax exemption (HTTP ${res.status})`,
    );
  }

  return res.json();
}

export interface TaxCalculationSummary {
  id: string;
  referenceId?: string | null;
  referenceType: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  ruleVersion: string;
  provider: string;
  createdAt?: string;
}

/**
 * Fetch recent auditable tax calculations / snapshots.
 */
export async function fetchAdminTaxCalculations(
  authToken?: string,
): Promise<TaxCalculationSummary[]> {
  const res = await fetch(`${ADMIN_BASE}/calculations`, {
    headers: getAuthHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to fetch tax calculations (HTTP ${res.status})`,
    );
  }

  return res.json();
}
