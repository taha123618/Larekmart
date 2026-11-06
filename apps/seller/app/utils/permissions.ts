/**
 * Role-Based Access Control (RBAC) & Seller Staff Permission Helpers
 */

export type SellerRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";

export interface PermissionCheckContext {
  role: SellerRole;
  permissions?: string[];
}

export function hasPermission(
  context: PermissionCheckContext | null | undefined,
  action: string,
): boolean {
  if (!context) return false;

  // Store Owners have universal access
  if (context.role === "OWNER") return true;

  // Wildcard permission grant
  if (context.permissions?.includes("*")) return true;

  // Role hierarchy defaults
  switch (action) {
    case "manage_team":
    case "manage_policies":
    case "update_storefront":
    case "manage_settings":
      return context.role === "ADMIN";

    case "manage_payouts":
    case "view_financials":
      return ["ADMIN", "MANAGER"].includes(context.role);

    case "create_product":
    case "edit_product":
    case "update_inventory":
    case "fulfill_order":
    case "reply_chat":
    case "reply_ticket":
      return ["ADMIN", "MANAGER", "STAFF"].includes(context.role);

    case "view_catalog":
    case "view_orders":
    case "view_reports":
      return ["ADMIN", "MANAGER", "STAFF", "VIEWER"].includes(context.role);

    default:
      return context.permissions?.includes(action) ?? false;
  }
}

export function canManageProducts(context: PermissionCheckContext | null | undefined): boolean {
  return hasPermission(context, "create_product");
}

export function canFulfillOrders(context: PermissionCheckContext | null | undefined): boolean {
  return hasPermission(context, "fulfill_order");
}

export function canViewFinancials(context: PermissionCheckContext | null | undefined): boolean {
  return hasPermission(context, "view_financials");
}

export function canManageStaff(context: PermissionCheckContext | null | undefined): boolean {
  return hasPermission(context, "manage_team");
}
