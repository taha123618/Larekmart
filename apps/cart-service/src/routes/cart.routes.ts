import { Router } from "express";
import { cartController } from "../controllers/cart.controller.js";
import { resolveCartIdentity } from "../middleware/auth.middleware.js";

const router: Router = Router();

// Apply hybrid identity resolution to all cart endpoints
router.use(resolveCartIdentity);

router.get("/", (req, res, next) => cartController.getCart(req, res, next));
router.get("/summary", (req, res, next) =>
  cartController.getSummary(req, res, next),
);
router.get("/admin/stats", (req, res, next) =>
  cartController.getAdminStats(req, res, next),
);
router.get("/admin/recent", (req, res, next) =>
  cartController.getRecentCarts(req, res, next),
);

router.post("/items", (req, res, next) =>
  cartController.addItem(req, res, next),
);
router.patch("/items/:item_id", (req, res, next) =>
  cartController.updateItem(req, res, next),
);
router.delete("/items/:item_id", (req, res, next) =>
  cartController.removeItem(req, res, next),
);

router.post("/merge", (req, res, next) =>
  cartController.mergeCart(req, res, next),
);

router.post("/coupons", (req, res, next) =>
  cartController.applyCoupon(req, res, next),
);
router.delete("/coupons/:code", (req, res, next) =>
  cartController.removeCoupon(req, res, next),
);

router.delete("/", (req, res, next) =>
  cartController.clearCart(req, res, next),
);
router.post("/refresh-pricing", (req, res, next) =>
  cartController.refreshPricing(req, res, next),
);

export default router;
