import { getApiGatewayUrl } from "./gateway.service";
import type { VendorStatus } from "@repo/types";

export interface PendingVendorDocument {
  id: string;
  vendorId: string;
  documentType: string;
  mediaFileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PendingVendorItem {
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
  documents?: PendingVendorDocument[];
  businessProfile?: {
    registeredAddressLine1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    businessEmail?: string;
    businessPhone?: string;
    industryCategory?: string;
    websiteUrl?: string | null;
    authorizedRepresentativeName?: string;
    authorizedRepresentativeEmail?: string;
    authorizedRepresentativePhone?: string;
    authorizedRepresentativeRole?: string;
  } | null;
}

export interface PendingVendorsResponse {
  vendors: PendingVendorItem[];
  total: number;
  page?: number;
  limit?: number;
}

export interface VerificationStats {
  pendingCount: number;
  verifiedThisWeek: number;
  rejectedThisWeek: number;
}

const getVendorVerificationBase = (): string => {
  const apiBase = getApiGatewayUrl();
  return `${apiBase}/api/v1/admin/vendors`;
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

export async function getPendingVendors(
  authToken?: string | null,
  options?: { page?: number; limit?: number; search?: string },
): Promise<PendingVendorsResponse> {
  const base = getVendorVerificationBase();
  const params = new URLSearchParams();
  params.set("status", "PENDING_VERIFICATION");
  if (options?.page) params.set("page", String(options.page));
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.search) params.set("search", options.search);

  const url = `${base}?${params.toString()}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getHeaders(authToken),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch pending vendors: HTTP ${res.status}`,
    );
  }

  const json = await res.json();
  if (Array.isArray(json)) {
    return { vendors: json, total: json.length };
  }
  return {
    vendors: json.vendors || json.data || [],
    total: json.total ?? (json.vendors?.length || 0),
    page: json.page,
    limit: json.limit,
  };
}

export async function getVendorDocuments(
  vendorId: string,
  authToken?: string | null,
): Promise<PendingVendorDocument[]> {
  const base = getVendorVerificationBase();
  // Attempt /:id/documents endpoint first
  const docUrl = `${base}/${vendorId}/documents`;
  try {
    const res = await fetch(docUrl, {
      method: "GET",
      headers: getHeaders(authToken),
    });

    if (res.ok) {
      const json = await res.json();
      return Array.isArray(json) ? json : json.documents || json.data || [];
    }
  } catch {
    // Fall back to get vendor details
  }

  // Fallback: fetch vendor details which includes documents
  const detailUrl = `${base}/${vendorId}`;
  const resDetail = await fetch(detailUrl, {
    method: "GET",
    headers: getHeaders(authToken),
  });

  if (!resDetail.ok) {
    const errorBody = await resDetail.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to fetch vendor documents: HTTP ${resDetail.status}`,
    );
  }

  const vendorDetail = await resDetail.json();
  return vendorDetail.documents || [];
}

export async function verifyVendor(
  vendorId: string,
  input: { reason?: string },
  authToken?: string | null,
): Promise<unknown> {
  const base = getVendorVerificationBase();
  const url = `${base}/${vendorId}/verify`;
  const body = {
    action: "VERIFY",
    reason: input.reason,
    notes: input.reason,
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // If /verify is not mapped or returned 404, fall back to /approve endpoint
    if (res.status === 404 || res.status === 405) {
      const approveRes = await fetch(`${base}/${vendorId}/approve`, {
        method: "POST",
        headers: getHeaders(authToken),
        body: JSON.stringify({ reviewNotes: input.reason }),
      });
      if (!approveRes.ok) {
        const errorBody = await approveRes.json().catch(() => ({}));
        throw new Error(
          errorBody.message || `Failed to verify vendor: HTTP ${approveRes.status}`,
        );
      }
      return approveRes.json();
    }

    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to verify vendor: HTTP ${res.status}`,
    );
  }

  return res.json();
}

export async function rejectVendor(
  vendorId: string,
  input: { reason: string },
  authToken?: string | null,
): Promise<unknown> {
  const base = getVendorVerificationBase();
  const url = `${base}/${vendorId}/verify`;
  const body = {
    action: "REJECT",
    reason: input.reason,
    rejectionReason: input.reason,
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: getHeaders(authToken),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // If /verify is not mapped or returned 404, fall back to /reject endpoint
    if (res.status === 404 || res.status === 405) {
      const rejectRes = await fetch(`${base}/${vendorId}/reject`, {
        method: "POST",
        headers: getHeaders(authToken),
        body: JSON.stringify({ rejectionReason: input.reason }),
      });
      if (!rejectRes.ok) {
        const errorBody = await rejectRes.json().catch(() => ({}));
        throw new Error(
          errorBody.message || `Failed to reject vendor: HTTP ${rejectRes.status}`,
        );
      }
      return rejectRes.json();
    }

    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Failed to reject vendor: HTTP ${res.status}`,
    );
  }

  return res.json();
}

export async function fetchVerificationStats(
  authToken?: string | null,
): Promise<VerificationStats> {
  const base = getVendorVerificationBase();
  try {
    const [pendingRes, verifiedRes, rejectedRes] = await Promise.all([
      fetch(`${base}?status=PENDING_VERIFICATION&limit=1`, {
        headers: getHeaders(authToken),
      }),
      fetch(`${base}?status=VERIFIED&limit=100`, {
        headers: getHeaders(authToken),
      }),
      fetch(`${base}?status=REJECTED&limit=100`, {
        headers: getHeaders(authToken),
      }),
    ]);

    const pendingData = pendingRes.ok ? await pendingRes.json() : { total: 0 };
    const verifiedData = verifiedRes.ok ? await verifiedRes.json() : { total: 0, vendors: [] };
    const rejectedData = rejectedRes.ok ? await rejectedRes.json() : { total: 0, vendors: [] };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const verifiedVendors = verifiedData.vendors || [];
    const verifiedThisWeek = verifiedVendors.filter(
      (v: PendingVendorItem) => new Date(v.updatedAt) >= oneWeekAgo,
    ).length;

    const rejectedVendors = rejectedData.vendors || [];
    const rejectedThisWeek = rejectedVendors.filter(
      (v: PendingVendorItem) => new Date(v.updatedAt) >= oneWeekAgo,
    ).length;

    return {
      pendingCount: pendingData.total ?? (Array.isArray(pendingData) ? pendingData.length : 0),
      verifiedThisWeek: verifiedThisWeek || (verifiedData.total > 0 ? verifiedData.total : 0),
      rejectedThisWeek: rejectedThisWeek || (rejectedData.total > 0 ? rejectedData.total : 0),
    };
  } catch {
    return {
      pendingCount: 0,
      verifiedThisWeek: 0,
      rejectedThisWeek: 0,
    };
  }
}
