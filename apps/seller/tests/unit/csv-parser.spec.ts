import { describe, it, expect } from "vitest";
import {
  parseCsvText,
  parseAndValidateCsv,
  type ValidationRule,
} from "../../app/utils/csv-parser";

describe("RFC 4180 CSV Parser & Schema Validator", () => {
  describe("parseCsvText", () => {
    it("parses simple unquoted rows separated by commas", () => {
      const csv = "sku,name,price\r\nSKU-1,Headphones,120\r\nSKU-2,Charger,40";
      const rows = parseCsvText(csv);

      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual(["sku", "name", "price"]);
      expect(rows[1]).toEqual(["SKU-1", "Headphones", "120"]);
      expect(rows[2]).toEqual(["SKU-2", "Charger", "40"]);
    });

    it("parses quoted cells containing commas, newlines, and escaped quotes", () => {
      const csv =
        'sku,description\r\nSKU-A,"Compact, lightweight"\r\nSKU-B,"Item with ""quotes"" inside"\r\nSKU-C,"Line 1\nLine 2"';
      const rows = parseCsvText(csv);

      expect(rows).toHaveLength(4);
      expect(rows[1][1]).toBe("Compact, lightweight");
      expect(rows[2][1]).toBe('Item with "quotes" inside');
      expect(rows[3][1]).toBe("Line 1\nLine 2");
    });

    it("handles trailing newlines without creating empty rows", () => {
      const csv = "a,b\r\n1,2\r\n\r\n";
      const rows = parseCsvText(csv);
      expect(rows).toHaveLength(2);
    });

    it("handles empty or whitespace-only input", () => {
      expect(parseCsvText("")).toEqual([]);
      expect(parseCsvText("   \n\r  ")).toEqual([]);
    });
  });

  describe("parseAndValidateCsv", () => {
    interface TestProduct {
      name: string;
      sku: string;
      price: number;
      stockQuantity: number;
    }

    const rules: ValidationRule<TestProduct>[] = [
      { field: "name", required: true },
      {
        field: "sku",
        required: true,
        validate: (v) => (/^[a-zA-Z0-9_-]+$/.test(v) ? null : "SKU contains invalid characters"),
      },
      {
        field: "price",
        required: true,
        validate: (v) => (!isNaN(Number(v)) && Number(v) > 0 ? null : "Price must be a positive number"),
        transform: (v) => Number(v),
      },
      {
        field: "stockQuantity",
        required: true,
        validate: (v) => (!isNaN(Number(v)) && Number(v) >= 0 ? null : "Stock must be >= 0"),
        transform: (v) => Math.round(Number(v)),
      },
    ];

    it("correctly identifies missing required headers", () => {
      const csv = "name,price\r\nWireless Mouse,25";
      const result = parseAndValidateCsv(csv, rules);

      expect(result.validRows).toBe(0);
      expect(result.errors.some((e) => e.field === "sku")).toBe(true);
      expect(result.errors[0].message).toContain('Missing required column header: "sku"');
    });

    it("parses valid rows and applies type transforms", () => {
      const csv = "name,sku,price,stockQuantity\r\nGaming Mouse,SKU-GM-1,49.99,150\r\nKeyboard,SKU-KB-2,89.50,45";
      const result = parseAndValidateCsv<TestProduct>(csv, rules);

      expect(result.errors).toHaveLength(0);
      expect(result.validRows).toBe(2);
      expect(result.data[0]).toEqual({
        name: "Gaming Mouse",
        sku: "SKU-GM-1",
        price: 49.99,
        stockQuantity: 150,
      });
      expect(typeof result.data[0].price).toBe("number");
      expect(typeof result.data[0].stockQuantity).toBe("number");
    });

    it("captures row-level errors for invalid rows while retaining valid rows", () => {
      const csv =
        "name,sku,price,stockQuantity\r\n" +
        "Valid Product,SKU-001,25.00,10\r\n" +
        ",SKU-002,30.00,5\r\n" + // missing name
        "Invalid Price,SKU-003,-15.00,20\r\n" + // negative price
        "Invalid SKU,SKU@#$,40.00,50\r\n" + // bad characters
        "Another Valid,SKU-005,100.00,5";

      const result = parseAndValidateCsv<TestProduct>(csv, rules);

      expect(result.totalRows).toBe(5);
      expect(result.validRows).toBe(2);
      expect(result.errors).toHaveLength(3);

      expect(result.errors[0].row).toBe(3);
      expect(result.errors[0].field).toBe("name");

      expect(result.errors[1].row).toBe(4);
      expect(result.errors[1].field).toBe("price");

      expect(result.errors[2].row).toBe(5);
      expect(result.errors[2].field).toBe("sku");

      expect(result.data).toHaveLength(2);
      expect(result.data[0].sku).toBe("SKU-001");
      expect(result.data[1].sku).toBe("SKU-005");
    });
  });
});
