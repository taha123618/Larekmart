import type { Context } from "koa";
import { WebhookService } from "../services/webhook.service.js";

export class WebhookController {
  static async handleCarrierWebhook(ctx: Context): Promise<void> {
    const carrier = ctx.params.carrier;
    if (!carrier) {
      ctx.status = 400;
      ctx.body = { message: "Carrier parameter is required" };
      return;
    }

    const signature =
      (ctx.headers["x-carrier-signature"] as string) ||
      (ctx.headers["x-webhook-signature"] as string) ||
      (ctx.headers["authorization"] as string);

    // Verify signature
    const isValid = WebhookService.verifySignature(carrier, signature);
    if (!isValid) {
      ctx.status = 401;
      ctx.body = { message: "Invalid webhook signature" };
      return;
    }

    const body = (ctx.request.body as Record<string, unknown>) ?? {};
    const trackingNumber =
      (body.trackingNumber as string) ||
      (body.tracking_number as string) ||
      (body.consignmentNumber as string) ||
      (body.awb as string);

    const status =
      (body.status as string) ||
      (body.event as string) ||
      (body.delivery_status as string);

    if (!trackingNumber || !status) {
      ctx.status = 400;
      ctx.body = {
        message:
          "Missing required fields: trackingNumber and status are mandatory in webhook payload",
      };
      return;
    }

    const eventId =
      (body.eventId as string) ||
      (body.id as string) ||
      (ctx.headers["x-event-id"] as string);

    const result = await WebhookService.processCarrierWebhook(carrier, {
      eventId,
      trackingNumber,
      status,
      description: body.description as string | undefined,
      location: body.location as string | undefined,
      timestamp: (body.timestamp as string) || (body.occurred_at as string),
      signature,
      rawPayload: body,
    });

    ctx.status = 200;
    ctx.body = result;
  }
}
