import type {
  UserDetailResponse,
  UserProfileResponse,
  UpdateProfileInput,
  AddressResponse,
  CreateAddressInput,
  UpdateAddressInput,
  UserPreferencesResponse,
  UpdatePreferencesInput,
  UserSettingsResponse,
  UpdateSettingsInput,
} from "@repo/types";

const USER_BASE =
  process.env.NEXT_PUBLIC_USER_SERVICE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  "http://localhost:8090";

const BASE = `${USER_BASE}/api/v1/users`;

const createAuthHeaders = (token?: string | null) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
};

// ==========================================
// User Profile & Account
// ==========================================

export async function fetchCurrentUser(
  token: string,
): Promise<UserDetailResponse | null> {
  try {
    const res = await fetch(`${BASE}/me`, {
      headers: createAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserDetailResponse;
  } catch (err) {
    console.error("Failed to fetch current user:", err);
    return null;
  }
}

export async function fetchUserProfile(
  token: string,
): Promise<UserProfileResponse | null> {
  try {
    const res = await fetch(`${BASE}/me/profile`, {
      headers: createAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfileResponse;
  } catch (err) {
    console.error("Failed to fetch user profile:", err);
    return null;
  }
}

export async function updateUserProfile(
  token: string,
  data: UpdateProfileInput,
): Promise<UserProfileResponse | null> {
  try {
    const res = await fetch(`${BASE}/me/profile`, {
      method: "PATCH",
      headers: createAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || "Failed to update profile");
    }
    return (await res.json()) as UserProfileResponse;
  } catch (err) {
    console.error("Failed to update user profile:", err);
    throw err;
  }
}

// ==========================================
// User Addresses
// ==========================================

export async function fetchUserAddresses(
  token: string,
): Promise<AddressResponse[]> {
  try {
    const res = await fetch(`${BASE}/me/addresses`, {
      headers: createAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return (await res.json()) as AddressResponse[];
  } catch (err) {
    console.error("Failed to fetch user addresses:", err);
    return [];
  }
}

export async function createUserAddress(
  token: string,
  data: CreateAddressInput,
): Promise<AddressResponse> {
  const res = await fetch(`${BASE}/me/addresses`, {
    method: "POST",
    headers: createAuthHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to create address");
  }
  return (await res.json()) as AddressResponse;
}

export async function updateUserAddress(
  token: string,
  addressId: string,
  data: UpdateAddressInput,
): Promise<AddressResponse> {
  const res = await fetch(`${BASE}/me/addresses/${addressId}`, {
    method: "PATCH",
    headers: createAuthHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update address");
  }
  return (await res.json()) as AddressResponse;
}

export async function deleteUserAddress(
  token: string,
  addressId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/me/addresses/${addressId}`, {
      method: "DELETE",
      headers: createAuthHeaders(token),
    });
    return res.ok;
  } catch (err) {
    console.error("Failed to delete user address:", err);
    return false;
  }
}

// ==========================================
// Preferences & Settings
// ==========================================

export async function fetchUserPreferences(
  token: string,
): Promise<UserPreferencesResponse | null> {
  try {
    const res = await fetch(`${BASE}/me/preferences`, {
      headers: createAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserPreferencesResponse;
  } catch (err) {
    console.error("Failed to fetch preferences:", err);
    return null;
  }
}

export async function updateUserPreferences(
  token: string,
  data: UpdatePreferencesInput,
): Promise<UserPreferencesResponse> {
  const res = await fetch(`${BASE}/me/preferences`, {
    method: "PATCH",
    headers: createAuthHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update preferences");
  }
  return (await res.json()) as UserPreferencesResponse;
}

export async function fetchUserSettings(
  token: string,
): Promise<UserSettingsResponse | null> {
  try {
    const res = await fetch(`${BASE}/me/settings`, {
      headers: createAuthHeaders(token),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserSettingsResponse;
  } catch (err) {
    console.error("Failed to fetch user settings:", err);
    return null;
  }
}

export async function updateUserSettings(
  token: string,
  data: UpdateSettingsInput,
): Promise<UserSettingsResponse> {
  const res = await fetch(`${BASE}/me/settings`, {
    method: "PATCH",
    headers: createAuthHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed to update settings");
  }
  return (await res.json()) as UserSettingsResponse;
}
