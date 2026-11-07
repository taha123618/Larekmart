import { describe, it, expect } from "vitest";

export interface VariantOption {
  name: string;
  values: string[];
}

export function calculateDiscountPercentage(originalPrice: number, salePrice: number): number {
  if (originalPrice <= 0 || salePrice >= originalPrice) return 0;
  const discount = ((originalPrice - salePrice) / originalPrice) * 100;
  return Math.round(discount * 10) / 10;
}

export function calculateProfitMargin(sellingPrice: number, unitCost: number): {
  grossProfit: number;
  marginPercentage: number;
  markupPercentage: number;
} {
  if (sellingPrice <= 0) {
    return { grossProfit: 0, marginPercentage: 0, markupPercentage: 0 };
  }
  const grossProfit = Math.round((sellingPrice - unitCost) * 100) / 100;
  const marginPercentage = Math.round((grossProfit / sellingPrice) * 1000) / 10;
  const markupPercentage = unitCost > 0 ? Math.round((grossProfit / unitCost) * 1000) / 10 : 0;
  return { grossProfit, marginPercentage, markupPercentage };
}

export function generateVariantMatrix(options: VariantOption[]): Record<string, string>[] {
  if (options.length === 0) return [];

  const cartesian = (arrays: string[][]): string[][] => {
    return arrays.reduce<string[][]>(
      (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
      [[]],
    );
  };

  const keys = options.map((o) => o.name);
  const values = options.map((o) => o.values);
  const combinations = cartesian(values);

  return combinations.map((combo) => {
    const record: Record<string, string> = {};
    keys.forEach((key, idx) => {
      record[key] = combo[idx] || "";
    });
    return record;
  });
}

export function generateSku(prefix: string, name: string, variantKey?: string): string {
  const cleanPrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cleanName = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 8);
  const variantPart = variantKey ? `-${variantKey.toUpperCase().replace(/[^A-Z0-9]/g, "")}` : "";
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${cleanPrefix}-${cleanName}${variantPart}-${randomSuffix}`;
}

export function evaluateStockStatus(stock: number, lowStockThreshold: number = 10): {
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  isLowStock: boolean;
} {
  if (stock <= 0) {
    return { status: "OUT_OF_STOCK", isLowStock: true };
  }
  if (stock <= lowStockThreshold) {
    return { status: "LOW_STOCK", isLowStock: true };
  }
  return { status: "IN_STOCK", isLowStock: false };
}

describe("Product Calculations & Matrix Generator (Unit)", () => {
  describe("Discount & Profit Margin Computations", () => {
    it("calculates discount percentages correctly", () => {
      expect(calculateDiscountPercentage(100, 75)).toBe(25);
      expect(calculateDiscountPercentage(199.99, 149.99)).toBe(25);
      expect(calculateDiscountPercentage(100, 100)).toBe(0);
      expect(calculateDiscountPercentage(100, 120)).toBe(0);
    });

    it("calculates gross profit, margin, and markup", () => {
      const { grossProfit, marginPercentage, markupPercentage } = calculateProfitMargin(100, 60);
      expect(grossProfit).toBe(40);
      expect(marginPercentage).toBe(40); // 40 / 100
      expect(markupPercentage).toBe(66.7); // 40 / 60 = 66.666% -> 66.7%
    });

    it("handles zero selling price gracefully", () => {
      const result = calculateProfitMargin(0, 50);
      expect(result.grossProfit).toBe(0);
      expect(result.marginPercentage).toBe(0);
    });
  });

  describe("Variant Matrix Generator", () => {
    it("generates full cartesian combinations across multiple variant dimensions", () => {
      const options: VariantOption[] = [
        { name: "Size", values: ["S", "M", "L"] },
        { name: "Color", values: ["Black", "White"] },
      ];

      const matrix = generateVariantMatrix(options);
      expect(matrix.length).toBe(6);
      expect(matrix[0]).toEqual({ Size: "S", Color: "Black" });
      expect(matrix[1]).toEqual({ Size: "S", Color: "White" });
      expect(matrix[5]).toEqual({ Size: "L", Color: "White" });
    });

    it("returns empty array for empty options list", () => {
      expect(generateVariantMatrix([])).toEqual([]);
    });
  });

  describe("SKU Generator", () => {
    it("produces standardized SKU format with prefix and clean slug", () => {
      const sku = generateSku("LM", "Mechanical Keyboard", "BLU-RGB");
      expect(sku).toMatch(/^LM-MECHANIC-BLURGB-[A-Z0-9]{4}$/);
    });
  });

  describe("Stock Status Evaluator", () => {
    it("classifies stock into OUT_OF_STOCK, LOW_STOCK, and IN_STOCK", () => {
      expect(evaluateStockStatus(0).status).toBe("OUT_OF_STOCK");
      expect(evaluateStockStatus(-2).isLowStock).toBe(true);

      expect(evaluateStockStatus(5, 10).status).toBe("LOW_STOCK");
      expect(evaluateStockStatus(10, 10).status).toBe("LOW_STOCK");

      expect(evaluateStockStatus(25, 10).status).toBe("IN_STOCK");
      expect(evaluateStockStatus(25, 10).isLowStock).toBe(false);
    });
  });
});
