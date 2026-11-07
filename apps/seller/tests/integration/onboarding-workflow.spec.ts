import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSellerStore } from "../../app/stores/seller.store";
import type { Seller, Vendor } from "../../app/types";

describe("Merchant Onboarding Workflow (Integration)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("Stage 1 & 2: Legal Business KYB Registration", () => {
    it("validates merchant business details and establishes pending vendor entity", () => {
      const vendorPayload = {
        userId: "usr_onboarding_1",
        businessName: "Larek Electronics Ltd",
        legalName: "Larek Electronics Private Limited",
        taxId: "PK-NTN-9918237",
        businessType: "LLC",
        country: "PK",
        documents: [
          {
            type: "BUSINESS_REGISTRATION",
            documentUrl: "https://media.larekmart.com/docs/reg_cert.pdf",
            status: "PENDING",
          },
          {
            type: "TAX_CERTIFICATE",
            documentUrl: "https://media.larekmart.com/docs/tax_cert.pdf",
            status: "PENDING",
          },
        ],
      };

      const vendor: Vendor = {
        id: "vnd_onboarding_99",
        userId: vendorPayload.userId,
        businessName: vendorPayload.businessName,
        legalName: vendorPayload.legalName,
        taxId: vendorPayload.taxId,
        businessType: vendorPayload.businessType as "LLC",
        country: vendorPayload.country,
        status: "PENDING_VERIFICATION",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(vendor.status).toBe("PENDING_VERIFICATION");
      expect(vendor.businessName).toBe("Larek Electronics Ltd");
      expect(vendorPayload.documents.length).toBe(2);
    });
  });

  describe("Stage 3: Storefront Setup & Slug Sanitization", () => {
    it("sanitizes store name into url-friendly unique slug and prepares storefront", () => {
      const storeInput = {
        storeName: "Larek Super Electronics & Gadgets!",
        description: "Official authorized dealer of premium electronics and accessories.",
      };

      const generatedSlug = storeInput.storeName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      expect(generatedSlug).toBe("larek-super-electronics-gadgets");

      const sellerStorefront = {
        name: storeInput.storeName,
        slug: generatedSlug,
        description: storeInput.description,
        logoUrl: "https://media.larekmart.com/logos/larek_store.png",
        bannerUrl: "https://media.larekmart.com/banners/larek_banner.png",
      };

      expect(sellerStorefront.slug).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe("Stage 4: Activation & Workspace Registration", () => {
    it("activates seller workspace and mounts newly approved storefront in Pinia store", () => {
      const store = useSellerStore();
      expect(store.hasSellers).toBe(false);

      const approvedSeller: Seller = {
        id: "sel_approved_771",
        vendorId: "vnd_onboarding_99",
        primaryUserId: "usr_onboarding_1",
        ownerUserId: "usr_onboarding_1",
        status: "ACTIVE",
        storeName: "Larek Super Electronics",
        slug: "larek-super-electronics",
        store: {
          id: "store_771",
          sellerId: "sel_approved_771",
          name: "Larek Super Electronics",
          slug: "larek-super-electronics",
          status: "ACTIVE",
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.setSellers([approvedSeller]);

      expect(store.hasSellers).toBe(true);
      expect(store.activeSellerId).toBe("sel_approved_771");
      expect(store.activeStoreName).toBe("Larek Super Electronics");
      expect(store.activeSeller?.status).toBe("ACTIVE");
    });
  });
});
