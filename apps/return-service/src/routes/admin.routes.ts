import Router from "@koa/router";
import { adminReturnController } from "../controllers/admin-return.controller.js";
import { shouldBeAdmin } from "../middleware/auth.middleware.js";

const router = new Router({ prefix: "/api/admin/returns" });

// All admin routes require a verified admin session
router.use(shouldBeAdmin);

/**
 * GET /api/admin/returns
 * List all returns with optional filters: status, sellerId, requiresManualReview.
 */
router.get("/", adminReturnController.listReturns.bind(adminReturnController));

/**
 * GET /api/admin/returns/:returnId
 * Get full details of any return (admin view, no ownership check).
 */
router.get(
  "/:returnId",
  adminReturnController.getReturn.bind(adminReturnController),
);

/**
 * POST /api/admin/returns/:returnId/approve
 * Approve a pending return request and optionally trigger prepaid label generation.
 */
router.post(
  "/:returnId/approve",
  adminReturnController.approveReturn.bind(adminReturnController),
);

/**
 * POST /api/admin/returns/:returnId/reject
 * Reject a pending return request with a mandatory reason.
 */
router.post(
  "/:returnId/reject",
  adminReturnController.rejectReturn.bind(adminReturnController),
);

/**
 * POST /api/admin/returns/:returnId/inspect
 * Record warehouse inspection outcomes and disposition per item.
 */
router.post(
  "/:returnId/inspect",
  adminReturnController.recordInspection.bind(adminReturnController),
);

/**
 * POST /api/admin/returns/:returnId/refund/retry
 * Retry a failed refund SAGA for a return.
 */
router.post(
  "/:returnId/refund/retry",
  adminReturnController.retryRefund.bind(adminReturnController),
);

export { router as adminRoutes };
