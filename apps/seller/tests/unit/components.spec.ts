import { describe, it, expect } from "vitest";

function getStatusBadgeClass(status: string): string {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "APPROVED":
    case "DELIVERED":
    case "PAID":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "PENDING":
    case "PROCESSING":
    case "UNDER_REVIEW":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "SUSPENDED":
    case "REJECTED":
    case "CANCELLED":
    case "FAILED":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
  }
}

describe("Status Badge Logic", () => {
  it("returns emerald badge classes for ACTIVE/APPROVED/DELIVERED", () => {
    expect(getStatusBadgeClass("ACTIVE")).toContain("bg-emerald-500/10");
    expect(getStatusBadgeClass("APPROVED")).toContain("text-emerald-600");
    expect(getStatusBadgeClass("DELIVERED")).toContain("border-emerald-500/20");
  });

  it("returns amber badge classes for PENDING/PROCESSING/UNDER_REVIEW", () => {
    expect(getStatusBadgeClass("PENDING")).toContain("bg-amber-500/10");
    expect(getStatusBadgeClass("UNDER_REVIEW")).toContain("text-amber-600");
  });

  it("returns rose badge classes for SUSPENDED/REJECTED/FAILED", () => {
    expect(getStatusBadgeClass("SUSPENDED")).toContain("bg-rose-500/10");
    expect(getStatusBadgeClass("REJECTED")).toContain("text-rose-600");
  });

  it("defaults to zinc classes for unknown statuses", () => {
    expect(getStatusBadgeClass("ARCHIVED")).toContain("bg-zinc-500/10");
  });
});

