import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "../../app/stores/auth.store";
import type { AuthUser } from "../../app/types";

describe("Auth Store (Unit)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("initializes with unauthenticated default state", () => {
    const auth = useAuthStore();
    expect(auth.clerkUserId).toBeNull();
    expect(auth.sessionToken).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isInitialized).toBe(false);
  });

  it("sets credentials and transitions to authenticated state", () => {
    const auth = useAuthStore();
    const mockUser: AuthUser = {
      id: "usr_merchant_99",
      email: "merchant@larekmart.com",
      firstName: "Taha",
      lastName: "Khan",
      imageUrl: "https://cdn.larekmart.com/avatars/usr_merchant_99.png",
      role: "SELLER",
      isSeller: true,
      canManageSellers: false,
    };

    auth.setAuth({
      userId: "usr_merchant_99",
      token: "jwt_mock_token_xyz_123",
      user: mockUser,
    });

    expect(auth.clerkUserId).toBe("usr_merchant_99");
    expect(auth.sessionToken).toBe("jwt_mock_token_xyz_123");
    expect(auth.user).toEqual(mockUser);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.isInitialized).toBe(true);
    expect(auth.currentUser?.email).toBe("merchant@larekmart.com");
  });

  it("clears credentials on clearAuth", () => {
    const auth = useAuthStore();
    auth.setAuth({
      userId: "usr_test",
      token: "token_123",
    });

    expect(auth.isAuthenticated).toBe(true);

    auth.clearAuth();

    expect(auth.clerkUserId).toBeNull();
    expect(auth.sessionToken).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.isInitialized).toBe(true);
  });

  it("handles auth without optional user object", () => {
    const auth = useAuthStore();
    auth.setAuth({
      userId: "usr_anon",
      token: "anon_token",
    });

    expect(auth.clerkUserId).toBe("usr_anon");
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(true);
  });
});
