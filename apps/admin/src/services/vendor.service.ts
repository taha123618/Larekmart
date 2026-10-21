/**
 * vendor.service.ts — Admin client for vendor-service (:8020) via API Gateway (:8090).
 */

import type {
  VendorBusinessProfile,
  VendorStatus,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_VENDOR_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const ADMIN_BASE = `${API_BASE}/api/v1/admin/vendors`;

export interface AdminVendorListItem {
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
  documents?: AdminVendorDocument[];
  verifications?: AdminVendorVerification[];
  members?: AdminVendorMember[];
  statusHistory?: AdminVendorStatusHistory[];
}

export interface AdminVendorDocument {
  id: string;
  vendorId: string;
  documentType: string;
  mediaFileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedByUserId: string;
  verificationStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVendorVerification {
  id: string;
  vendorId: string;
  workflowType: string;
  status: "INITIATED" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
  reviewedByAdminId?: string | null;
  reviewNotes?: string | null;
  verificationScores?: Record<string, unknown> | null;
  submittedAt: string;
  decidedAt?: string | null;
}

export interface AdminVendorMember {
  id: string;
  vendorId: string;
  userId: string;
  role: string;
  permissions: string[];
  status: string;
  joinedAt: string;
}

export interface AdminVendorStatusHistory {
  id: string;
  vendorId: string;
  fromStatus: string;
  toStatus: string;
  changedByUserId: string;
  changeReason: string;
  notes?: string | null;
  createdAt: string;
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
 * Fetch all vendors with optional filtering by status and country
 */
export async function fetchAdminVendors(
  params?: { status?: string; country?: string; limit?: number; offset?: number },
  authToken?: string,
): Promise<{ vendors: AdminVendorListItem[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.country) query.set("country", params.country);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const url = `${ADMIN_BASE}${query.toString() ? `?${query.toString()}` : ""}`;

  const res = await fetch(url, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch vendors (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetch single vendor with complete profile, documents, and status history
 */
export async function fetchAdminVendorDetails(
  id: string,
  authToken?: string,
): Promise<AdminVendorListItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch vendor details (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.vendor;
}

/**
 * Perform KYB Verification decision (APPROVED / REJECTED)
 */
export async function verifyAdminVendor(
  id: string,
  input: {
    status: "APPROVED" | "REJECTED";
    reviewNotes?: string;
    verificationScores?: Record<string, unknown>;
  },
  authToken?: string,
): Promise<AdminVendorListItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}/verify`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to record verification (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.vendor;
}

/**
 * Transition vendor operational status (e.g. SUSPENDED, ACTIVE, TERMINATED)
 */
export async function updateAdminVendorStatus(
  id: string,
  input: {
    status: VendorStatus;
    reason: string;
    notes?: string;
  },
  authToken?: string,
): Promise<AdminVendorListItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}/status`, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update vendor status (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.vendor;
}

/**
 * Verify individual uploaded compliance document
 */
export async function verifyAdminDocument(
  vendorId: string,
  documentId: string,
  input: {
    status: "ACCEPTED" | "REJECTED";
    rejectionReason?: string;
  },
  authToken?: string,
): Promise<AdminVendorDocument> {
  const res = await fetch(
    `${ADMIN_BASE}/${vendorId}/documents/${documentId}/verify`,
    {
      method: "POST",
      headers: getHeaders(authToken),
      body: JSON.stringify(input),
    },
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to verify document (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.document;
}

/**
 * Fetch pending KYB verifications queue
 */
export async function fetchPendingVerifications(
  authToken?: string,
): Promise<AdminVendorVerification[]> {
  const res = await fetch(`${ADMIN_BASE}/verifications/pending`, {
    headers: getHeaders(authToken),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pending verifications (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.verifications || [];
}
