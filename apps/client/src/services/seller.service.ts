/**
 * seller.service.ts — Client service for merchant storefronts & seller operations via API Gateway (:8090).
 */

import type {
  CreateSellerInput,
  SellerStore,
  SellerPolicy,
  SellerStatus,
  StorefrontStatus,
} from "@repo/types";

const API_BASE =
  process.env.NEXT_PUBLIC_SELLER_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const SELLERS_BASE = `${API_BASE}/api/v1/sellers`;
const STOREFRONTS_BASE = `${API_BASE}/api/v1/storefronts`;

export interface PublicStorefrontResponse {
  store: {
    id: string;
    sellerId: string;
    name: string;
    slug: string;
    headline?: string | null;
    description?: string | null;
    logoMediaId?: string | null;
    bannerMediaId?: string | null;
    vacationMode?: boolean;
    vacationMessage?: string | null;
    status: StorefrontStatus;
  };
  policies: Array<{
    id: string;
    policyType: string;
    title: string;
    content: string;
    version: number;
  }>;
  seller: {
    id: string;
    primaryCurrency: string;
    status: SellerStatus;
    onboardedAt?: string | null;
  };
}

export interface ClientSeller {
  id: string;
  vendorId: string;
  ownerUserId: string;
  status: SellerStatus;
  primaryCurrency: string;
  onboardedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  store?: SellerStore | null;
  policies?: SellerPolicy[];
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
 * Public discovery endpoint: Fetch public storefront profile by slug
 */
export async function fetchStorefront(
  slug: string,
): Promise<PublicStorefrontResponse | null> {
  try {
    const res = await fetch(`${STOREFRONTS_BASE}/${encodeURIComponent(slug)}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch storefront (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn(`fetchStorefront for slug '${slug}' error:`, err);
    return null;
  }
}

/**
 * Register a new seller storefront account
 */
export async function createSeller(
  input: CreateSellerInput,
  authToken?: string,
): Promise<ClientSeller> {
  const res = await fetch(SELLERS_BASE, {
    method: "POST",
    headers: getHeaders(authToken),
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to create seller (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.seller;
}

/**
 * Retrieve the current authenticated user's seller account
 */
export async function getMySeller(
  authToken?: string,
): Promise<ClientSeller | null> {
  try {
    const res = await fetch(`${SELLERS_BASE}/me`, {
      headers: getHeaders(authToken),
      cache: "no-store",
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch seller (HTTP ${res.status})`);
    }

    const data = await res.json();
    return data.seller || null;
  } catch (err) {
    console.warn("getMySeller error:", err);
    return null;
  }
}

/**
 * Update seller store branding, description, or vacation mode
 */
export async function updateSellerStore(
  sellerId: string,
  storeData: Partial<SellerStore>,
  authToken?: string,
): Promise<SellerStore> {
  const res = await fetch(`${SELLERS_BASE}/${sellerId}/store`, {
    method: "PUT",
    headers: getHeaders(authToken),
    body: JSON.stringify(storeData),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData.message || `Failed to update store (HTTP ${res.status})`,
    );
  }
  const data = await res.json();
  return data.store;
}

export interface ClientSystemSettings {
  id: string;
  isSellerEnabled: boolean;
  isSellerRegistrationOpen: boolean;
  isStorefrontsActive: boolean;
  maintenanceMessage?: string | null;
  updatedAt: string;
  updatedBy?: string | null;
}

/**
 * Public discovery endpoint: Fetch platform-wide marketplace system settings
 */
export async function fetchSystemSettings(): Promise<ClientSystemSettings> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/system-settings`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return {
        id: "marketplace",
        isSellerEnabled: true,
        isSellerRegistrationOpen: true,
        isStorefrontsActive: true,
        maintenanceMessage:
          "Marketplace seller operations are temporarily paused for routine maintenance.",
        updatedAt: new Date().toISOString(),
      };
    }
    return res.json();
  } catch (err) {
    console.warn("fetchSystemSettings error:", err);
    return {
      id: "marketplace",
      isSellerEnabled: true,
      isSellerRegistrationOpen: true,
      isStorefrontsActive: true,
      maintenanceMessage:
        "Marketplace seller operations are temporarily paused for routine maintenance.",
      updatedAt: new Date().toISOString(),
    };
  }
}
