import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatCompactNumber,
  formatDate,
  formatRelativeTime,
  formatPercentage,
} from "../../app/utils/formatters";
import {
  hasPermission,
  canManageProducts,
  canFulfillOrders,
  canViewFinancials,
  canManageStaff,
} from "../../app/utils/permissions";

describe("Formatting Utilities", () => {
  it("formats currency with proper symbols and precision", () => {
    expect(formatCurrency(1249.5)).toBe("$1,249.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(NaN)).toBe("$0.00");
  });

  it("formats compact numbers cleanly", () => {
    expect(formatCompactNumber(1500)).toBe("1.5K");
    expect(formatCompactNumber(2500000)).toBe("2.5M");
    expect(formatCompactNumber(45)).toBe("45");
  });

  it("formats dates and relative times", () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe("Just now");

    const fixedDate = new Date("2026-05-15T10:00:00Z");
    expect(formatDate(fixedDate)).toContain("May 15, 2026");
  });

  it("formats percentage values accurately", () => {
    expect(formatPercentage(98.42, 1)).toBe("98.4%");
    expect(formatPercentage(100, 0)).toBe("100%");
  });
});

describe("RBAC & Permission Helpers", () => {
  it("grants universal permissions to OWNER", () => {
    const owner = { role: "OWNER" as const };
    expect(hasPermission(owner, "anything")).toBe(true);
    expect(canManageStaff(owner)).toBe(true);
    expect(canViewFinancials(owner)).toBe(true);
    expect(canManageProducts(owner)).toBe(true);
  });

  it("enforces staff permissions hierarchy", () => {
    const staff = { role: "STAFF" as const };
    expect(canManageProducts(staff)).toBe(true);
    expect(canFulfillOrders(staff)).toBe(true);
    expect(canViewFinancials(staff)).toBe(false);
    expect(canManageStaff(staff)).toBe(false);

    const viewer = { role: "VIEWER" as const };
    expect(canManageProducts(viewer)).toBe(false);
    expect(canFulfillOrders(viewer)).toBe(false);
    expect(hasPermission(viewer, "view_catalog")).toBe(true);
  });

  it("handles wildcard permissions", () => {
    const customUser = { role: "STAFF" as const, permissions: ["*"] };
    expect(hasPermission(customUser, "manage_team")).toBe(true);
  });
});
