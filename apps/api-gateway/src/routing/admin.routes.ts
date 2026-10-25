import { services } from "../gateway/service-registry.js";
import type { GatewayRouteConfig } from "@repo/types";

export const adminRoutes: GatewayRouteConfig[] = [
  // 1. Order Chart & Admin Analytics
  {
    prefix: "/order-chart",
    target: services.order.url,
    serviceName: services.order.name,
    timeoutMs: services.order.timeoutMs,
    rewritePrefix: "/order-chart",
    requireAdmin: true,
  },
  {
    prefix: "/api/v1/analytics",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics",
    requireAdmin: true,
  },
  {
    prefix: "/analytics",
    target: services.analytic.url,
    serviceName: services.analytic.name,
    timeoutMs: services.analytic.timeoutMs,
    rewritePrefix: "/analytics",
    requireAdmin: true,
  },

  // 2. Media Service Admin Media Management
  {
    prefix: "/api/v1/admin/media",
    target: services.media.url,
    serviceName: services.media.name,
    timeoutMs: services.media.timeoutMs,
    rewritePrefix: "/api/v1/admin/media",
    requireAdmin: true,
  },

  // 3. Review Service Admin Moderation & Reports
  {
    prefix: "/api/v1/admin/reviews",
    target: services.review.url,
    serviceName: services.review.name,
    timeoutMs: services.review.timeoutMs,
    rewritePrefix: "/api/v1/admin/reviews",
    requireAdmin: true,
  },

  // 4. Wishlist Service Admin Overview & Management
  {
    prefix: "/api/v1/admin/wishlists",
    target: services.wishlist.url,
    serviceName: services.wishlist.name,
    timeoutMs: services.wishlist.timeoutMs,
    rewritePrefix: "/api/v1/admin/wishlists",
    requireAdmin: true,
  },

  // 5. Promotion Service Admin Campaigns & Coupons
  {
    prefix: "/api/v1/admin/promotions",
    target: services.promotion.url,
    serviceName: services.promotion.name,
    timeoutMs: services.promotion.timeoutMs,
    rewritePrefix: "/api/v1/admin/promotions",
    requireAdmin: true,
  },
  {
    prefix: "/api/v1/admin/coupons",
    target: services.promotion.url,
    serviceName: services.promotion.name,
    timeoutMs: services.promotion.timeoutMs,
    rewritePrefix: "/api/v1/admin/coupons",
    requireAdmin: true,
  },

  // 6. Tax Service Admin Rules, Jurisdictions & Exemptions
  {
    prefix: "/api/v1/admin/tax",
    target: services.tax.url,
    serviceName: services.tax.name,
    timeoutMs: services.tax.timeoutMs,
    rewritePrefix: "/api/v1/admin/tax",
    requireAdmin: true,
  },

  // 7. Return Service Admin — Approvals, Rejections & Inspections
  {
    prefix: "/api/v1/admin/returns",
    target: services.return.url,
    serviceName: services.return.name,
    timeoutMs: services.return.timeoutMs,
    rewritePrefix: "/api/admin/returns",
    requireAdmin: true,
  },

  // 8. Pricing Service Admin — Price Lists, Product/Variant Prices, Price History
  {
    prefix: "/api/v1/admin/prices",
    target: services.pricing.url,
    serviceName: services.pricing.name,
    timeoutMs: services.pricing.timeoutMs,
    rewritePrefix: "/api/v1/admin/prices",
    requireAdmin: true,
  },
  {
    prefix: "/api/v1/admin/price-lists",
    target: services.pricing.url,
    serviceName: services.pricing.name,
    timeoutMs: services.pricing.timeoutMs,
    rewritePrefix: "/api/v1/admin/price-lists",
    requireAdmin: true,
  },

  // 9. Vendor Service Admin Compliance & Verification
  {
    prefix: "/api/v1/admin/vendors",
    target: services.vendor.url,
    serviceName: services.vendor.name,
    timeoutMs: services.vendor.timeoutMs,
    rewritePrefix: "/api/v1/admin/vendors",
    requireAdmin: true,
  },

  // 10. Seller Service Admin Management
  {
    prefix: "/api/v1/admin/sellers",
    target: services.seller.url,
    serviceName: services.seller.name,
    timeoutMs: services.seller.timeoutMs,
    rewritePrefix: "/api/v1/admin/sellers",
    requireAdmin: true,
  },

  // 11. Platform System Settings (Admin / Super Admin Management)
  {
    prefix: "/api/v1/admin/system-settings",
    target: services.seller.url,
    serviceName: services.seller.name,
    timeoutMs: services.seller.timeoutMs,
    rewritePrefix: "/api/v1/admin/system-settings",
    requireAdmin: true,
  },

  // 12. Super Admin Delegations Management
  {
    prefix: "/api/v1/admin/delegations",
    target: services.seller.url,
    serviceName: services.seller.name,
    timeoutMs: services.seller.timeoutMs,
    rewritePrefix: "/api/v1/admin/delegations",
    requireAdmin: true,
  },
];
