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
import { shouldBeAdmin } from "../middleware/authMiddleware";

const router: Router = Router();

router.post("/", shouldBeAdmin, createProduct);
router.post("/backfill-search", shouldBeAdmin, backfillSearchIndexHandler);
router.put("/:id", shouldBeAdmin, updateProduct);
router.delete("/:id", shouldBeAdmin, deleteProduct);
router.get("/", getProducts);
// Must be registered before "/:id" so it is not captured as a product id.
router.get("/search", searchProducts);
router.get("/:id", getProduct);

export default router;
