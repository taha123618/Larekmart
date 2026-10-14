import { Hono } from "hono";
import { promotionService } from "../services/promotion.service.js";
import {
  shouldBeAdmin,
  optionalUserOrGuest,
  type AuthVariables,
} from "../middleware/auth.middleware.js";
import {
  CreatePromotionSchema,
  UpdatePromotionSchema,
  CreateCouponSchema,
  ValidateCouponSchema,
  PromotionQuoteSchema,
  CreateReservationSchema,
  CommitReservationSchema,
  ReleaseReservationSchema,
} from "@repo/types";

export const promotionRoutes = new Hono<{ Variables: AuthVariables }>();

// ==============================================================================
// 1. Customer-Facing Endpoints
// ==============================================================================

/**
 * GET /api/v1/promotions/active
 * Get all active campaigns/promotions currently running.
 */
promotionRoutes.get("/promotions/active", async (c) => {
  const active = await promotionService.getActivePromotions();
  return c.json({ data: active });
});

/**
 * GET /api/v1/promotions/:promotionId
 * Get single promotion details.
 */
promotionRoutes.get("/promotions/:promotionId", async (c) => {
  const promotionId = c.req.param("promotionId");
  const promo = await promotionService.getPromotionById(promotionId);
  if (!promo) {
    return c.json({ message: "Promotion not found" }, 404);
  }
  return c.json({ data: promo });
});

/**
 * POST /api/v1/promotions/validate
 * Validate a coupon code during cart or checkout.
 */
promotionRoutes.post("/promotions/validate", optionalUserOrGuest, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = ValidateCouponSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400,
    );
  }

  const userId = c.get("userId") || parseResult.data.userId;
  const guestId = c.get("guestId") || parseResult.data.guestId;

  const result = await promotionService.validateCoupon({
    ...parseResult.data,
    userId,
    guestId,
  });

  return c.json(result);
});

/**
 * POST /api/v1/promotions/quote
 * Calculate applicable discounts, free-shipping, and stacking quotes for cart items.
 */
promotionRoutes.post("/promotions/quote", optionalUserOrGuest, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = PromotionQuoteSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400,
    );
  }

  const userId = c.get("userId") || parseResult.data.userId;
  const guestId = c.get("guestId") || parseResult.data.guestId;

  const quote = await promotionService.quotePromotions({
    ...parseResult.data,
    userId,
    guestId,
  });

  return c.json({ data: quote });
});

/**
 * POST /api/v1/promotions/reservations
 * Atomically reserve a promotion during checkout.
 */
promotionRoutes.post(
  "/promotions/reservations",
  optionalUserOrGuest,
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parseResult = CreateReservationSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        { message: "Invalid payload", errors: parseResult.error.format() },
        400,
      );
    }

    const userId = c.get("userId") || parseResult.data.userId;
    const guestId = c.get("guestId") || parseResult.data.guestId;

    try {
      const reservation = await promotionService.createReservation({
        ...parseResult.data,
        userId,
        guestId,
      });
      return c.json({ data: reservation }, 201);
    } catch (error: any) {
      return c.json(
        { message: error.message || "Failed to reserve promotion" },
        400,
      );
    }
  },
);

/**
 * POST /api/v1/promotions/reservations/:id/commit
 * Commit an existing reservation upon successful order placement.
 */
promotionRoutes.post("/promotions/reservations/:id/commit", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CommitReservationSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { message: "Invalid payload", errors: parseResult.error.format() },
      400,
    );
  }

  try {
    const redemption = await promotionService.commitReservation(
      id,
      parseResult.data.orderId,
    );
    return c.json({ data: redemption });
  } catch (error: any) {
    return c.json(
      { message: error.message || "Failed to commit reservation" },
      400,
    );
  }
});

/**
 * POST /api/v1/promotions/reservations/:id/release
 * Release a reserved promotion when checkout or order creation fails or is cancelled.
 */
promotionRoutes.post("/promotions/reservations/:id/release", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parseResult = ReleaseReservationSchema.safeParse(body);

  try {
    const released = await promotionService.releaseReservation(
      id,
      parseResult.success ? parseResult.data.reason : undefined,
    );
    if (!released) {
      return c.json({ message: "Reservation not found" }, 404);
    }
    return c.json({ data: released });
  } catch (error: any) {
    return c.json(
      { message: error.message || "Failed to release reservation" },
      400,
    );
  }
});

// ==============================================================================
// 2. Administrative Endpoints (Admin RBAC Guarded)
// ==============================================================================

/**
 * POST /api/v1/admin/promotions
 * Create a new campaign promotion.
 */
promotionRoutes.post("/admin/promotions", shouldBeAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreatePromotionSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { message: "Validation error", errors: parseResult.error.format() },
      400,
    );
  }

  const actorId = c.get("userId") || "admin";
  try {
    const created = await promotionService.createPromotion(
      parseResult.data,
      actorId,
    );
    return c.json({ data: created }, 201);
  } catch (error: any) {
    return c.json(
      { message: error.message || "Failed to create promotion" },
      400,
    );
  }
});

/**
 * PATCH /api/v1/admin/promotions/:promotionId
 * Update an existing promotion.
 */
promotionRoutes.patch(
  "/admin/promotions/:promotionId",
  shouldBeAdmin,
  async (c) => {
    const promotionId = c.req.param("promotionId");
    const body = await c.req.json().catch(() => ({}));
    const parseResult = UpdatePromotionSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json(
        { message: "Validation error", errors: parseResult.error.format() },
        400,
      );
    }

    const actorId = c.get("userId") || "admin";
    try {
      const updated = await promotionService.updatePromotion(
        promotionId,
        parseResult.data,
        actorId,
      );
      if (!updated) {
        return c.json({ message: "Promotion not found" }, 404);
      }
      return c.json({ data: updated });
    } catch (error: any) {
      return c.json(
        { message: error.message || "Failed to update promotion" },
        400,
      );
    }
  },
);

/**
 * POST /api/v1/admin/promotions/:promotionId/activate
 * Activate a promotion.
 */
promotionRoutes.post(
  "/admin/promotions/:promotionId/activate",
  shouldBeAdmin,
  async (c) => {
    const promotionId = c.req.param("promotionId");
    const actorId = c.get("userId") || "admin";

    const activated = await promotionService.activatePromotion(
      promotionId,
      actorId,
    );
    if (!activated) {
      return c.json({ message: "Promotion not found" }, 404);
    }
    return c.json({ data: activated });
  },
);

/**
 * POST /api/v1/admin/promotions/:promotionId/deactivate
 * Deactivate a promotion.
 */
promotionRoutes.post(
  "/admin/promotions/:promotionId/deactivate",
  shouldBeAdmin,
  async (c) => {
    const promotionId = c.req.param("promotionId");
    const actorId = c.get("userId") || "admin";

    const deactivated = await promotionService.deactivatePromotion(
      promotionId,
      actorId,
    );
    if (!deactivated) {
      return c.json({ message: "Promotion not found" }, 404);
    }
    return c.json({ data: deactivated });
  },
);

/**
 * POST /api/v1/admin/coupons
 * Create a new coupon code for a promotion.
 */
promotionRoutes.post("/admin/coupons", shouldBeAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parseResult = CreateCouponSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json(
      { message: "Validation error", errors: parseResult.error.format() },
      400,
    );
  }

  try {
    const coupon = await promotionService.createCoupon(parseResult.data);
    return c.json({ data: coupon }, 201);
  } catch (error: any) {
    return c.json({ message: error.message || "Failed to create coupon" }, 400);
  }
});

/**
 * GET /api/v1/admin/promotions/:promotionId/redemptions
 * View promotion redemptions history and order associations.
 */
promotionRoutes.get(
  "/admin/promotions/:promotionId/redemptions",
  shouldBeAdmin,
  async (c) => {
    const promotionId = c.req.param("promotionId");
    const limit = Math.min(
      100,
      Math.max(1, Number(c.req.query("limit") ?? 50)),
    );
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0));

    const result = await promotionService.getPromotionRedemptions(
      promotionId,
      limit,
      offset,
    );
    return c.json({
      data: result.redemptions,
      pagination: {
        total: result.total,
        limit,
        offset,
      },
    });
  },
);

/**
 * GET /api/v1/admin/promotions/overview
 * Overview metrics for promotion analytics.
 */
promotionRoutes.get("/admin/promotions/overview", shouldBeAdmin, async (c) => {
  const overview = await promotionService.getOverview();
  return c.json({ data: overview });
});
