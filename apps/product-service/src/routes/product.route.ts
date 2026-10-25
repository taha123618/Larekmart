import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  updateProduct,
} from "../controllers/product.controller";
import {
  backfillSearchIndexHandler,
  searchProducts,
} from "../controllers/search.controller";
import {
  shouldBeAdmin,
  shouldBeSellerOrAdmin,
} from "../middleware/authMiddleware";

const router: Router = Router();

router.post("/", shouldBeSellerOrAdmin, createProduct);
router.post("/backfill-search", shouldBeAdmin, backfillSearchIndexHandler);
router.put("/:id", shouldBeSellerOrAdmin, updateProduct);
router.delete("/:id", shouldBeSellerOrAdmin, deleteProduct);
router.get("/", getProducts);
// Must be registered before "/:id" so it is not captured as a product id.
router.get("/search", searchProducts);
router.get("/:id", getProduct);

export default router;
