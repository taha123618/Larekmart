import { describe, it, expect } from "vitest";
import { z } from "zod";

const createProductSchema = z.object({
  name: z.string().min(3, "Title must be at least 3 characters"),
  sku: z.string().min(2, "SKU is required"),
  price: z.number().positive("Price must be positive"),
  stock: z.number().int().nonnegative("Stock cannot be negative"),
  categoryId: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

const createVendorSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  legalName: z.string().min(2, "Legal entity name is required"),
  taxId: z.string().min(4, "Valid Tax ID / NTN / EIN is required"),
  businessType: z.enum(["INDIVIDUAL", "LLC", "CORPORATION", "PARTNERSHIP"]),
  country: z.string().length(2, "Must be a 2-letter ISO country code"),
});

describe("Seller Dashboard Zod Schemas", () => {
  it("validates valid product payload", () => {
    const validData = {
      name: "Wireless Noise Canceling Headphones",
      sku: "AUDIO-NC-001",
      price: 199.99,
      stock: 50,
      categoryId: "cat_electronics",
      description: "Premium over-ear headphones with ANC.",
    };

    const result = createProductSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid product payload with negative price or stock", () => {
    const invalidData = {
      name: "Bad",
      sku: "B",
      price: -10,
      stock: -5,
      categoryId: "",
    };

    const result = createProductSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("validates vendor KYB registration payload", () => {
    const validVendor = {
      businessName: "Larek Global Trading",
      legalName: "Larek Trading LLC",
      taxId: "TAX-99482-PK",
      businessType: "LLC" as const,
      country: "PK",
    };

    const result = createVendorSchema.safeParse(validVendor);
    expect(result.success).toBe(true);
  });
});
