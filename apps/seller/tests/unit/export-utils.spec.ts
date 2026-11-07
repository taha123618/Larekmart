import { describe, it, expect } from "vitest";
import {
  formatCsvValue,
  convertToCsv,
  triggerFileDownload,
  type CsvColumn,
} from "../../app/utils/export";

describe("RFC 4180 CSV Export Utility", () => {
  describe("formatCsvValue", () => {
    it("returns empty string for null and undefined", () => {
      expect(formatCsvValue(null)).toBe("");
      expect(formatCsvValue(undefined)).toBe("");
    });

    it("returns unquoted string for simple alphanumeric values", () => {
      expect(formatCsvValue("Wireless Headphones")).toBe("Wireless Headphones");
      expect(formatCsvValue(12500)).toBe("12500");
    });

    it("quotes values containing commas", () => {
      expect(formatCsvValue("Electronics, Gadgets & Audio")).toBe(
        '"Electronics, Gadgets & Audio"',
      );
    });

    it("escapes quotes and wraps in quotes when value contains double quotes", () => {
      expect(formatCsvValue('15" OLED Display Monitor')).toBe(
        '"15"" OLED Display Monitor"',
      );
    });

    it("quotes values containing newlines or carriage returns", () => {
      expect(formatCsvValue("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(formatCsvValue("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
    });
  });

  describe("convertToCsv", () => {
    interface TestData {
      id: string;
      name: string;
      price: number;
    }

    const columns: CsvColumn<TestData>[] = [
      { key: "id", label: "SKU ID" },
      { key: "name", label: "Product Name" },
      {
        key: "price",
        label: "Price (PKR)",
        formatter: (v) => `${Number(v).toLocaleString()} PKR`,
      },
    ];

    it("generates correct RFC 4180 headers and rows", () => {
      const rows: TestData[] = [
        { id: "SKU-001", name: "Ergonomic Keyboard", price: 15000 },
        { id: "SKU-002", name: '27" 4K "Ultra" Display', price: 95000 },
      ];

      const csv = convertToCsv(columns, rows);
      const lines = csv.split("\r\n");

      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe("SKU ID,Product Name,Price (PKR)");
      expect(lines[1]).toBe('SKU-001,Ergonomic Keyboard,"15,000 PKR"');
      expect(lines[2]).toBe('SKU-002,"27"" 4K ""Ultra"" Display","95,000 PKR"');
    });

    it("handles empty rows by generating header line only", () => {
      const csv = convertToCsv(columns, []);
      expect(csv).toBe("SKU ID,Product Name,Price (PKR)");
    });
  });

  describe("triggerFileDownload in SSR environment", () => {
    it("safely exits without throwing when running outside browser DOM", () => {
      expect(() => triggerFileDownload("data", "test.csv", "text/csv")).not.toThrow();
    });
  });
});
