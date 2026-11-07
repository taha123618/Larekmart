import { describe, it, expect } from "vitest";
import { convertToCsv, type CsvColumn } from "../../app/utils/export";

interface DailyMetric {
  date: string;
  gmv: number;
  refunds: number;
  orders: number;
}

interface AnalyticsSummary {
  gmv: number;
  netRevenue: number;
  totalOrders: number;
  aov: number;
  fulfillmentRate: number;
  currency: string;
}

function computeAnalyticsPeriodMetrics(
  data: DailyMetric[],
  commissionRate = 0.12,
  currency = "PKR",
): AnalyticsSummary {
  const gmv = data.reduce((sum, d) => sum + d.gmv, 0);
  const totalRefunds = data.reduce((sum, d) => sum + d.refunds, 0);
  const totalOrders = data.reduce((sum, d) => sum + d.orders, 0);
  const netRevenue = (gmv * (1 - commissionRate)) - totalRefunds;
  const aov = totalOrders > 0 ? gmv / totalOrders : 0;

  return {
    gmv: Math.round(gmv * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalOrders,
    aov: Math.round(aov * 100) / 100,
    fulfillmentRate: 98.4,
    currency,
  };
}

describe("Seller Analytics & Reporting Workflow", () => {
  const sampleMetrics: DailyMetric[] = [
    { date: "2026-11-01", gmv: 25000, refunds: 500, orders: 12 },
    { date: "2026-11-02", gmv: 34000, refunds: 1200, orders: 18 },
    { date: "2026-11-03", gmv: 42000, refunds: 800, orders: 22 },
    { date: "2026-11-04", gmv: 51000, refunds: 1500, orders: 29 },
  ];

  it("calculates accurate aggregate GMV, net revenue, and AOV across reporting intervals", () => {
    const summary = computeAnalyticsPeriodMetrics(sampleMetrics, 0.12, "PKR");

    // Total GMV = 25000 + 34000 + 42000 + 51000 = 152000
    expect(summary.gmv).toBe(152000);
    // Total Orders = 12 + 18 + 22 + 29 = 81
    expect(summary.totalOrders).toBe(81);
    // AOV = 152000 / 81 = 1876.54
    expect(summary.aov).toBe(1876.54);
    // Total Refunds = 500 + 1200 + 800 + 1500 = 4000
    // Net Revenue = (152000 * 0.88) - 4000 = 133760 - 4000 = 129760
    expect(summary.netRevenue).toBe(129760);
    expect(summary.currency).toBe("PKR");
  });

  it("handles zero order volume gracefully without division by zero errors", () => {
    const emptyMetrics: DailyMetric[] = [];
    const summary = computeAnalyticsPeriodMetrics(emptyMetrics);

    expect(summary.gmv).toBe(0);
    expect(summary.totalOrders).toBe(0);
    expect(summary.aov).toBe(0);
    expect(summary.netRevenue).toBe(0);
  });

  it("exports period metric breakdown into an RFC 4180 CSV report format", () => {
    const columns: CsvColumn<DailyMetric>[] = [
      { key: "date", label: "Date" },
      { key: "gmv", label: "Gross Sales (PKR)", formatter: (v) => `${Number(v).toFixed(2)}` },
      { key: "refunds", label: "Refunds (PKR)", formatter: (v) => `${Number(v).toFixed(2)}` },
      { key: "orders", label: "Orders", formatter: (v) => String(v) },
    ];

    const csvContent = convertToCsv(columns, sampleMetrics);
    const lines = csvContent.split("\r\n");

    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Date,Gross Sales (PKR),Refunds (PKR),Orders");
    expect(lines[1]).toBe("2026-11-01,25000.00,500.00,12");
    expect(lines[4]).toBe("2026-11-04,51000.00,1500.00,29");
  });

  it("constructs structured JSON export payloads containing metadata and time series", () => {
    const summary = computeAnalyticsPeriodMetrics(sampleMetrics);
    const payload = {
      sellerId: "seller_test_987",
      storeName: "Apex Tech Official Store",
      period: "7d",
      summary,
      timeSeries: sampleMetrics,
    };

    expect(payload.sellerId).toBe("seller_test_987");
    expect(payload.summary.gmv).toBe(152000);
    expect(payload.timeSeries).toHaveLength(4);
    expect(JSON.stringify(payload)).toContain('"storeName":"Apex Tech Official Store"');
  });
});
