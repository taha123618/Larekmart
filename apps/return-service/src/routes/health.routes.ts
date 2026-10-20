import Router from "@koa/router";
import { healthController } from "../controllers/health.controller.js";

const router = new Router();

/**
 * GET /health
 * Liveness probe — checks DB connectivity.
 */
router.get("/health", healthController.health.bind(healthController));

/**
 * GET /ready
 * Readiness probe — lightweight check.
 */
router.get("/ready", healthController.ready.bind(healthController));

/**
 * GET /metrics
 * Prometheus metrics snapshot.
 */
router.get("/metrics", healthController.metrics.bind(healthController));

export { router as healthRoutes };
