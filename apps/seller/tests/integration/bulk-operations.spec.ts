import { describe, it, expect } from "vitest";
import { parseAndValidateCsv, type ValidationRule } from "../../app/utils/csv-parser";
import { convertToCsv, type CsvColumn } from "../../app/utils/export";

describe("Bulk Operations & Batch Data Pipelines", () => {
  interface InventoryAdjustmentRow {
    sku: string;
    availableStock: number;
    reorderPoint: number;
    safetyStock: number;
    warehouse: string;
  }

  const inventoryRules: ValidationRule<InventoryAdjustmentRow>[] = [
    { field: "sku", required: true },
    {
      field: "availableStock",
      required: true,
      validate: (val) => (!isNaN(Number(val)) && Number(val) >= 0 ? null : "Invalid available stock"),
      transform: (val) => Math.round(Number(val)),
    },
    {
      field: "reorderPoint",
      required: false,
      transform: (val) => (val ? Math.round(Number(val)) : 10),
    },
    {
      field: "safetyStock",
      required: false,
      transform: (val) => (val ? Math.round(Number(val)) : 5),
    },
    { field: "warehouse", required: false },
  ];

  it("processes a multi-warehouse stock replenishment spreadsheet accurately", () => {
    const csvContent =
      "sku,availableStock,reorderPoint,safetyStock,warehouse\r\n" +
      "SKU-ANC-001,250,30,15,Karachi-Hub\r\n" +
      "SKU-GAN-100,180,20,10,Lahore-Logistics\r\n" +
      "SKU-MNT-500,75,10,5,Islamabad-Depot";

    const result = parseAndValidateCsv<InventoryAdjustmentRow>(csvContent, inventoryRules);

    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toBe(3);
    expect(result.data[0].warehouse).toBe("Karachi-Hub");
    expect(result.data[1].availableStock).toBe(180);
    expect(result.data[2].reorderPoint).toBe(10);
  });

  it("defaults missing optional fields such as reorderPoint and safetyStock", () => {
    const csvContent =
      "sku,availableStock,reorderPoint,safetyStock,warehouse\r\n" +
      "SKU-MINIMAL,90,,,";

    const result = parseAndValidateCsv<InventoryAdjustmentRow>(csvContent, inventoryRules);

    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toBe(1);
    expect(result.data[0].availableStock).toBe(90);
    expect(result.data[0].reorderPoint).toBe(10); // default applied
    expect(result.data[0].safetyStock).toBe(5); // default applied
  });

  it("exports current inventory ledger into an RFC 4180 export stream", () => {
    const currentStock = [
      { sku: "SKU-1", productName: "Ergonomic Desk", availableStock: 14, reservedStock: 2, status: "IN_STOCK" },
      { sku: "SKU-2", productName: '49" Ultra-Wide Monitor', availableStock: 3, reservedStock: 1, status: "LOW_STOCK" },
    ];

    const columns: CsvColumn<(typeof currentStock)[0]>[] = [
      { key: "sku", label: "SKU" },
      { key: "productName", label: "Product Title" },
      { key: "availableStock", label: "Available" },
      { key: "reservedStock", label: "Reserved" },
      { key: "status", label: "Status" },
    ];

    const csvOutput = convertToCsv(columns, currentStock);
    const lines = csvOutput.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("SKU,Product Title,Available,Reserved,Status");
    expect(lines[1]).toBe("SKU-1,Ergonomic Desk,14,2,IN_STOCK");
    expect(lines[2]).toBe('SKU-2,"49"" Ultra-Wide Monitor",3,1,LOW_STOCK');
  });
});
