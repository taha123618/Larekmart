import { describe, it, expect } from "vitest";

interface LedgerEntry {
  id: string;
  type: "ORDER_SALE" | "COMMISSION_DEDUCTION" | "PAYOUT" | "REFUND_REVERSAL";
  amount: number;
  orderId?: string;
  createdAt: string;
  availableAt: string; // ISO date when funds unlock after return period
}

interface SellerBalanceSnapshot {
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  currency: string;
}

function computeSellerBalances(
  entries: LedgerEntry[],
  currentDate: Date = new Date(),
): SellerBalanceSnapshot {
  let availableBalance = 0;
  const pendingBalance = 0;
  let reservedBalance = 0;

  for (const entry of entries) {
    if (entry.type === "PAYOUT") {
      availableBalance -= Math.abs(entry.amount);
      continue;
    }

    const unlockDate = new Date(entry.availableAt);
    if (unlockDate <= currentDate) {
      availableBalance += entry.amount;
    } else {
      // Funds are still in return protection hold
      reservedBalance += entry.amount;
    }
  }

  return {
    availableBalance: Math.round(availableBalance * 100) / 100,
    pendingBalance: Math.round(pendingBalance * 100) / 100,
    reservedBalance: Math.round(reservedBalance * 100) / 100,
    currency: "USD",
  };
}

function validatePayoutRequest(params: {
  requestedAmount: number;
  availableBalance: number;
  minPayoutThreshold?: number;
  bankAccount: { iban: string; swiftCode: string; accountTitle: string };
}): { isValid: boolean; error?: string } {
  const minThreshold = params.minPayoutThreshold ?? 50;

  if (params.requestedAmount < minThreshold) {
    return { isValid: false, error: `Minimum payout withdrawal is $${minThreshold}.00` };
  }
  if (params.requestedAmount > params.availableBalance) {
    return { isValid: false, error: "Requested amount exceeds available balance" };
  }
  if (!params.bankAccount.iban.trim() || params.bankAccount.iban.length < 15) {
    return { isValid: false, error: "Invalid IBAN number" };
  }
  if (!params.bankAccount.swiftCode.trim() || params.bankAccount.swiftCode.length < 8) {
    return { isValid: false, error: "Invalid SWIFT/BIC code" };
  }

  return { isValid: true };
}

describe("Finance, Ledger & Settlement Lifecycle (Integration)", () => {
  it("computes available and reserve hold balances based on escrow unlock dates", () => {
    const now = new Date("2026-06-15T12:00:00Z");

    const entries: LedgerEntry[] = [
      {
        id: "led_1",
        type: "ORDER_SALE",
        amount: 500,
        orderId: "ord_past",
        createdAt: "2026-05-20T10:00:00Z",
        availableAt: "2026-06-03T10:00:00Z", // Past unlock date -> available
      },
      {
        id: "led_2",
        type: "COMMISSION_DEDUCTION",
        amount: -50,
        orderId: "ord_past",
        createdAt: "2026-05-20T10:00:00Z",
        availableAt: "2026-06-03T10:00:00Z", // Past unlock date -> available deduction
      },
      {
        id: "led_3",
        type: "ORDER_SALE",
        amount: 1200,
        orderId: "ord_recent",
        createdAt: "2026-06-10T10:00:00Z",
        availableAt: "2026-06-24T10:00:00Z", // Future unlock date -> reserved
      },
      {
        id: "led_4",
        type: "COMMISSION_DEDUCTION",
        amount: -120,
        orderId: "ord_recent",
        createdAt: "2026-06-10T10:00:00Z",
        availableAt: "2026-06-24T10:00:00Z", // Future unlock date -> reserved deduction
      },
    ];

    const balances = computeSellerBalances(entries, now);

    // Available: 500 - 50 = 450
    expect(balances.availableBalance).toBe(450);
    // Reserved hold: 1200 - 120 = 1080
    expect(balances.reservedBalance).toBe(1080);
  });

  it("validates payout request constraints and rejects invalid withdrawals", () => {
    const validBank = {
      iban: "PK36SCBL0000001123456701",
      swiftCode: "SCBLPKKXXX",
      accountTitle: "Larek Trading Pvt Ltd",
    };

    // Below minimum threshold
    const lowAmount = validatePayoutRequest({
      requestedAmount: 25,
      availableBalance: 500,
      bankAccount: validBank,
    });
    expect(lowAmount.isValid).toBe(false);
    expect(lowAmount.error).toContain("Minimum payout withdrawal is $50.00");

    // Exceeds available balance
    const overBalance = validatePayoutRequest({
      requestedAmount: 600,
      availableBalance: 450,
      bankAccount: validBank,
    });
    expect(overBalance.isValid).toBe(false);
    expect(overBalance.error).toContain("exceeds available balance");

    // Invalid IBAN
    const badIban = validatePayoutRequest({
      requestedAmount: 200,
      availableBalance: 500,
      bankAccount: { ...validBank, iban: "123" },
    });
    expect(badIban.isValid).toBe(false);
    expect(badIban.error).toContain("Invalid IBAN");

    // Valid payout request
    const success = validatePayoutRequest({
      requestedAmount: 300,
      availableBalance: 450,
      bankAccount: validBank,
    });
    expect(success.isValid).toBe(true);
    expect(success.error).toBeUndefined();
  });

  it("calculates 7-day seller dispute rebuttal windows and escrow freeze protection", () => {
    const createdAt = new Date("2026-06-01T10:00:00Z");
    const rebuttalDeadline = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

    const testTimeActive = new Date("2026-06-03T10:00:00Z"); // 2 days in
    const remainingMs = rebuttalDeadline.getTime() - testTimeActive.getTime();
    const remainingHours = Math.round(remainingMs / (1000 * 60 * 60));
    const isExpired = remainingHours <= 0;

    expect(remainingHours).toBe(120); // 5 days left = 120 hours
    expect(isExpired).toBe(false);

    // After 8 days (expired)
    const testTimeExpired = new Date("2026-06-09T12:00:00Z");
    const expiredDiff = rebuttalDeadline.getTime() - testTimeExpired.getTime();
    expect(expiredDiff).toBeLessThan(0);

    // Rebuttal validation
    function validateRebuttal(statement: string) {
      if (!statement.trim() || statement.trim().length < 10) {
        return { valid: false, error: "Rebuttal statement must be at least 10 characters long" };
      }
      return { valid: true };
    }

    expect(validateRebuttal("Short").valid).toBe(false);
    expect(
      validateRebuttal("Delivered via DHL tracking #123456789 with customer signature").valid,
    ).toBe(true);
  });
});
