import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSellerStore } from "../../app/stores/seller.store";
import { useUiStore } from "../../app/stores/ui.store";
import type { Seller } from "../../app/types";

describe("Seller Dashboard Pinia Stores", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("UI Store", () => {
    it("initializes with default sidebar and drawer states", () => {
      const ui = useUiStore();
      expect(ui.isSidebarCollapsed).toBe(false);
      expect(ui.isMobileMenuOpen).toBe(false);
    });

    it("toggles sidebar collapsed state", () => {
      const ui = useUiStore();
      ui.toggleSidebar();
      expect(ui.isSidebarCollapsed).toBe(true);
      ui.toggleSidebar();
      expect(ui.isSidebarCollapsed).toBe(false);
    });

    it("opens and closes mobile navigation drawer", () => {
      const ui = useUiStore();
      ui.openMobileMenu();
      expect(ui.isMobileMenuOpen).toBe(true);
      ui.closeMobileMenu();
      expect(ui.isMobileMenuOpen).toBe(false);
      ui.toggleMobileMenu();
      expect(ui.isMobileMenuOpen).toBe(true);
    });
  });

  describe("Seller Workspace Store", () => {
    it("manages active seller workspace and auto-selects first store", () => {
      const sellerStore = useSellerStore();
      const mockSellers: Seller[] = [
        {
          id: "sel_1",
          vendorId: "vnd_1",
          primaryUserId: "usr_1",
          ownerUserId: "usr_1",
          status: "ACTIVE",
          storeName: "Alpha Store",
          slug: "alpha-store",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "sel_2",
          vendorId: "vnd_2",
          primaryUserId: "usr_1",
          ownerUserId: "usr_1",
          status: "ACTIVE",
          storeName: "Beta Store",
          slug: "beta-store",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      sellerStore.setSellers(mockSellers);
      expect(sellerStore.sellers.length).toBe(2);
      expect(sellerStore.activeSellerId).toBe("sel_1");
      expect(sellerStore.activeSeller?.storeName).toBe("Alpha Store");

      sellerStore.setActiveSeller("sel_2");
      expect(sellerStore.activeSellerId).toBe("sel_2");
      expect(sellerStore.activeSeller?.storeName).toBe("Beta Store");

      sellerStore.clearSellers();
      expect(sellerStore.sellers.length).toBe(0);
      expect(sellerStore.activeSellerId).toBeNull();
      expect(sellerStore.activeSeller).toBeNull();
    });
  });
});
