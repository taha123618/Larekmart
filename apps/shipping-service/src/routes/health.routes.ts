import Router from "@koa/router";
import { HealthController } from "../controllers/health.controller.js";

export const healthRouter = new Router({ prefix: "/api/v1/health" });

healthRouter.get("/", HealthController.getHealth);
healthRouter.get("/live", HealthController.getLive);
healthRouter.get("/ready", HealthController.getReady);
