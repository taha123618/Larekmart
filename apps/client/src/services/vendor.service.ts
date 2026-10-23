/**
 * vendor.service.ts — Client service for vendor registration & KYB management via API Gateway (:8090).
 */

import type {
  CreateVendorInput,
  VendorBusinessProfile,
  VendorStatus,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_VENDOR_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const VENDORS_BASE = `${API_BASE}/api/v1/vendors`;

export interface ClientVendor {
  id: string;
  legalName: string;
  tradeName?: string | null;
  organizationType: string;
  registrationNumber: string;
  taxIdentifier: string;
  country: string;
  status: VendorStatus;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  businessProfile?: VendorBusinessProfile | null;
  documents?: Array<{
    id: string;
    documentType: string;
    fileName: string;
    verificationStatus: string;
  }>;
}

function getHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Register a new legal vendor business organization
 */
export async function registerVendor(
  input: CreateVendorInput,
  authToken?: string,
): Promise<ClientVendor> {
  const res = await fetch(VENDORS_BASE, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to register vendor (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.vendor;
}

/**
 * Retrieve the current authenticated user's vendor organization
 */
export async function getMyVendor(
  authToken?: string,
): Promise<ClientVendor | null> {
  try {
    const res = await fetch(`${VENDORS_BASE}/me`, {
      headers: getHeaders(authToken),
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch vendor (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.vendor || null;
  } catch (err) {
    console.warn("getMyVendor error:", err);
    return null;
  }
}

/**
 * Update vendor business profile (address, representative contact)
 */
export async function updateVendorProfile(
  vendorId: string,
  profile: Partial<VendorBusinessProfile>,
  authToken?: string,
): Promise<VendorBusinessProfile> {
  const res = await fetch(`${VENDORS_BASE}/${vendorId}/business-profile`, {
    method: "PUT",
    headers: getHeaders(authToken),
    body: JSON.stringify(profile),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update profile (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.businessProfile;
}

/**
 * Submit compliance verification dossier for review
 */
export async function submitVendorVerification(
  vendorId: string,
  input: { workflowType?: string; notes?: string },
  authToken?: string,
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${VENDORS_BASE}/${vendorId}/verifications`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to submit verification (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.verification;
}
