import { describe, it, expect } from "vitest";

interface NavItem {
  label: string;
  to: string;
  icon: string;
  permission?: string;
  badge?: string | number;
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "i-heroicons-squares-2x2" },
  { label: "Products", to: "/products", icon: "i-heroicons-cube", permission: "manage_products" },
  { label: "Inventory", to: "/inventory", icon: "i-heroicons-circle-stack", permission: "manage_products" },
  { label: "Orders", to: "/orders", icon: "i-heroicons-shopping-bag", permission: "fulfill_orders" },
  { label: "Finance", to: "/finance", icon: "i-heroicons-banknotes", permission: "view_financials" },
  { label: "Marketing", to: "/marketing", icon: "i-heroicons-ticket", permission: "manage_products" },
  { label: "Reviews", to: "/reviews", icon: "i-heroicons-star", permission: "manage_products" },
  { label: "Account Health", to: "/account-health", icon: "i-heroicons-shield-check" },
  { label: "Messages", to: "/chat", icon: "i-heroicons-chat-bubble-left-right" },
  { label: "Support", to: "/support", icon: "i-heroicons-lifebuoy" },
  { label: "Settings", to: "/settings", icon: "i-heroicons-cog-6-tooth", permission: "manage_settings" },
];

function isRouteActive(currentPath: string, targetTo: string): boolean {
  if (targetTo === "/dashboard") {
    return currentPath === "/dashboard" || currentPath === "/";
  }
  return currentPath === targetTo || currentPath.startsWith(`${targetTo}/`);
}

function filterNavByRole(items: NavItem[], role: "OWNER" | "STAFF" | "VIEWER"): NavItem[] {
  if (role === "OWNER") return items;
  if (role === "STAFF") {
    return items.filter((item) => item.permission !== "view_financials" && item.permission !== "manage_settings");
  }
  // VIEWER can only see Dashboard, Messages, Support, Account Health
  return items.filter((item) => !item.permission);
}

function generateBreadcrumbs(pathname: string): { label: string; to: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: { label: string; to: string }[] = [{ label: "Home", to: "/dashboard" }];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const formatted = segment
      .replace(/-/g, " ")
      .replace(/^[a-z]/, (c) => c.toUpperCase());
    breadcrumbs.push({ label: formatted, to: currentPath });
  }

  return breadcrumbs;
}

describe("Navigation & Route Matching (Unit)", () => {
  it("determines active navigation item accurately", () => {
    expect(isRouteActive("/", "/dashboard")).toBe(true);
    expect(isRouteActive("/dashboard", "/dashboard")).toBe(true);
    expect(isRouteActive("/products", "/products")).toBe(true);
    expect(isRouteActive("/products/create", "/products")).toBe(true);
    expect(isRouteActive("/orders/ord_123", "/orders")).toBe(true);
    expect(isRouteActive("/settings/staff", "/settings")).toBe(true);
    expect(isRouteActive("/products", "/dashboard")).toBe(false);
  });

  it("filters navigation items strictly based on role hierarchy", () => {
    const ownerNav = filterNavByRole(navItems, "OWNER");
    expect(ownerNav.length).toBe(navItems.length);

    const staffNav = filterNavByRole(navItems, "STAFF");
    expect(staffNav.some((i) => i.label === "Finance")).toBe(false);
    expect(staffNav.some((i) => i.label === "Settings")).toBe(false);
    expect(staffNav.some((i) => i.label === "Products")).toBe(true);
    expect(staffNav.some((i) => i.label === "Orders")).toBe(true);

    const viewerNav = filterNavByRole(navItems, "VIEWER");
    expect(viewerNav.some((i) => i.label === "Products")).toBe(false);
    expect(viewerNav.some((i) => i.label === "Orders")).toBe(false);
    expect(viewerNav.some((i) => i.label === "Dashboard")).toBe(true);
    expect(viewerNav.some((i) => i.label === "Messages")).toBe(true);
  });

  it("generates structured breadcrumb hierarchy", () => {
    const crumbs = generateBreadcrumbs("/products/create");
    expect(crumbs).toEqual([
      { label: "Home", to: "/dashboard" },
      { label: "Products", to: "/products" },
      { label: "Create", to: "/products/create" },
    ]);

    const settingsCrumbs = generateBreadcrumbs("/settings/policies");
    expect(settingsCrumbs[2]).toEqual({ label: "Policies", to: "/settings/policies" });
  });
});
