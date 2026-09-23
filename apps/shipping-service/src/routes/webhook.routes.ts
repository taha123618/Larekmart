import Router from "@koa/router";
import { WebhookController } from "../controllers/webhook.controller.js";

export const webhookRouter = new Router({ prefix: "/api/v1/webhooks" });

webhookRouter.post(
  "/carriers/:carrier",
  WebhookController.handleCarrierWebhook,
);
