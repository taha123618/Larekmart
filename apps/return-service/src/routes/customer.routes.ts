import Router from "@koa/router";
import { customerReturnController } from "../controllers/customer-return.controller.js";
import { shouldBeUser } from "../middleware/auth.middleware.js";

const router = new Router({ prefix: "/api/returns" });

// All customer routes require a verified user
router.use(shouldBeUser);

/**
 * POST /api/returns/orders/:orderId
 * Submit a new return request for a delivered order.
 */
router.post(
  "/orders/:orderId",
  customerReturnController.createReturn.bind(customerReturnController),
);

/**
 * GET /api/returns
 * List the authenticated customer's own returns.
 */
router.get(
  "/",
  customerReturnController.getMyReturns.bind(customerReturnController),
);

/**
 * GET /api/returns/:returnId
 * Get a specific return request (only if owned by caller).
 */
router.get(
  "/:returnId",
  customerReturnController.getReturnById.bind(customerReturnController),
);

/**
 * DELETE /api/returns/:returnId
 * Cancel a return request (only while in REQUESTED status).
 */
router.delete(
  "/:returnId",
  customerReturnController.cancelReturn.bind(customerReturnController),
);

/**
 * POST /api/returns/:returnId/evidence
 * Attach a media-service asset as evidence.
 */
router.post(
  "/:returnId/evidence",
  customerReturnController.attachEvidence.bind(customerReturnController),
);

/**
 * POST /api/returns/:returnId/tracking
 * Customer submits their own return-shipment tracking number.
 */
router.post(
  "/:returnId/tracking",
  customerReturnController.submitTracking.bind(customerReturnController),
);

export { router as customerRoutes };
