import type { UserDetailResponse } from "@repo/types";
import { getApiGatewayUrl } from "./gateway.service";

const USER_BASE = getApiGatewayUrl();

const BASE = `${USER_BASE}/api/v1/users/admin/users`;

export interface AdminUserListItem {
  id: string;
  authUserId: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "PENDING_VERIFICATION";
  isSeller?: boolean;
  createdAt: string;
  updatedAt: string;
  profile?: {
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function fetchAdminUsers(
  token: string,
  query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    isSeller?: boolean;
  },
): Promise<AdminUsersListResponse | null> {
  const params = new URLSearchParams();
  if (query?.page) params.set("page", String(query.page));
  if (query?.limit) params.set("limit", String(query.limit));
  if (query?.search) params.set("search", query.search);
  if (query?.status) params.set("status", query.status);
  if (query?.isSeller !== undefined)
    params.set("isSeller", String(query.isSeller));

  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AdminUsersListResponse;
  } catch (err) {
    console.error("Failed to fetch admin users from user-service:", err);
    return null;
  }
}

export async function fetchAdminUserDetail(
  token: string,
  id: string,
): Promise<UserDetailResponse | null> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserDetailResponse;
  } catch (err) {
    console.error(`Failed to fetch admin user detail for ${id}:`, err);
    return null;
  }
}

export async function updateAdminUserStatus(
  token: string,
  id: string,
  data:
    | {
        status?:
          | "ACTIVE"
          | "SUSPENDED"
          | "DEACTIVATED"
          | "PENDING_VERIFICATION";
        isSeller?: boolean;
      }
    | "ACTIVE"
    | "SUSPENDED"
    | "DEACTIVATED"
    | "PENDING_VERIFICATION",
): Promise<boolean> {
  const payload = typeof data === "string" ? { status: data } : data;
  try {
    const res = await fetch(`${BASE}/${id}/status`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error(`Failed to update status for ${id}:`, err);
    return false;
  }
}
