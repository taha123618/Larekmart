import { describe, it, expect } from "vitest";

export type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionOrderStatus(current: OrderStatus, next: OrderStatus): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export function formatCarrierTrackingUrl(carrier: string, trackingNumber: string): string | null {
  const trimmed = trackingNumber.trim();
  if (!trimmed) return null;

  switch (carrier.toUpperCase()) {
    case "TCS":
      return `https://www.tcsexpress.com/tracking?track=${encodeURIComponent(trimmed)}`;
    case "LEOPARDS":
      return `https://www.leopardscourier.com/tracking?track=${encodeURIComponent(trimmed)}`;
    case "DHL":
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(trimmed)}`;
    case "FEDEX":
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trimmed)}`;
    default:
      return null;
  }
}

export function calculateSellerNetReceivable(params: {
  subtotal: number;
  taxAmount: number;
  commissionRate: number; // e.g. 0.10 for 10%
  fixedFee: number; // e.g. 0.30
}): {
  grossTotal: number;
  commissionAmount: number;
  netReceivable: number;
} {
  const grossTotal = Math.round((params.subtotal + params.taxAmount) * 100) / 100;
  const commissionAmount = Math.round((params.subtotal * params.commissionRate + params.fixedFee) * 100) / 100;
  const netReceivable = Math.max(0, Math.round((grossTotal - commissionAmount) * 100) / 100);

  return {
    grossTotal,
    commissionAmount,
    netReceivable,
  };
}

describe("Order Lifecycle & Settlement Calculations (Unit)", () => {
  describe("Order Status Transition State Machine", () => {
    it("allows valid forward lifecycle transitions", () => {
      expect(canTransitionOrderStatus("PENDING", "PROCESSING")).toBe(true);
      expect(canTransitionOrderStatus("PROCESSING", "SHIPPED")).toBe(true);
      expect(canTransitionOrderStatus("SHIPPED", "DELIVERED")).toBe(true);
      expect(canTransitionOrderStatus("DELIVERED", "REFUNDED")).toBe(true);
      expect(canTransitionOrderStatus("PENDING", "CANCELLED")).toBe(true);
      expect(canTransitionOrderStatus("PROCESSING", "CANCELLED")).toBe(true);
    });

    it("prohibits illegal backwards or skipped transitions", () => {
      expect(canTransitionOrderStatus("DELIVERED", "PROCESSING")).toBe(false);
      expect(canTransitionOrderStatus("DELIVERED", "PENDING")).toBe(false);
      expect(canTransitionOrderStatus("CANCELLED", "PROCESSING")).toBe(false);
      expect(canTransitionOrderStatus("CANCELLED", "SHIPPED")).toBe(false);
      expect(canTransitionOrderStatus("REFUNDED", "DELIVERED")).toBe(false);
      expect(canTransitionOrderStatus("PENDING", "DELIVERED")).toBe(false); // cannot skip processing/shipping
    });
  });

  describe("Carrier Tracking URL Resolution", () => {
    it("generates correct tracking links for supported carriers", () => {
      expect(formatCarrierTrackingUrl("TCS", "99182371")).toContain("tcsexpress.com/tracking?track=99182371");
      expect(formatCarrierTrackingUrl("DHL", "AWB-44910")).toContain("dhl.com/en/express/tracking.html?AWB=AWB-44910");
      expect(formatCarrierTrackingUrl("LEOPARDS", "LEO-7718")).toContain("leopardscourier.com/tracking?track=LEO-7718");
      expect(formatCarrierTrackingUrl("FEDEX", "789123456789")).toContain("fedex.com/fedextrack/?trknbr=789123456789");
    });

    it("returns null for unknown carriers or blank tracking numbers", () => {
      expect(formatCarrierTrackingUrl("LOCAL_COURIER", "12345")).toBeNull();
      expect(formatCarrierTrackingUrl("TCS", "   ")).toBeNull();
    });
  });

  describe("Seller Net Receivable Computation", () => {
    it("deducts marketplace commission and fixed fee from gross", () => {
      const result = calculateSellerNetReceivable({
        subtotal: 100,
        taxAmount: 5,
        commissionRate: 0.10, // 10% = $10.00
        fixedFee: 0.30, // $0.30
      });

      expect(result.grossTotal).toBe(105);
      expect(result.commissionAmount).toBe(10.30);
      expect(result.netReceivable).toBe(94.70); // 105 - 10.30
    });

    it("ensures net receivable does not drop below zero", () => {
      const result = calculateSellerNetReceivable({
        subtotal: 0.20,
        taxAmount: 0,
        commissionRate: 0.10,
        fixedFee: 5.00, // fee higher than order value
      });

      expect(result.netReceivable).toBe(0);
    });
  });
});
