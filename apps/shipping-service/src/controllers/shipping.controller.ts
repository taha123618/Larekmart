import type { Context } from "koa";
import { RateService } from "../services/rate.service.js";
import { ShippingRateRequestSchema } from "@repo/types";

export class ShippingController {
  static async getRates(ctx: Context): Promise<void> {
    const rawQuery = ctx.query;
    let items = [];
    if (typeof rawQuery.items === "string") {
      try {
        items = JSON.parse(rawQuery.items);
      } catch {
        items = [];
      }
    }

    const parsed = ShippingRateRequestSchema.safeParse({
      country: rawQuery.country ?? "PK",
      city: rawQuery.city,
      postalCode: rawQuery.postalCode,
      weight: rawQuery.weight ? Number(rawQuery.weight) : undefined,
      isCod: rawQuery.isCod === "true" || rawQuery.isCod === "1",
      codAmount: rawQuery.codAmount ? Number(rawQuery.codAmount) : undefined,
      items,
    });

    if (!parsed.success) {
      ctx.status = 400;
      ctx.body = {
        message: "Invalid shipping rate request parameters",
        errors: parsed.error.issues,
      };
      return;
    }

    const rates = await RateService.calculateRates(parsed.data);
    ctx.status = 200;
    ctx.body = rates;
  }

  static async getMethods(ctx: Context): Promise<void> {
    const methods = await RateService.getMethods();
    ctx.status = 200;
    ctx.body = { methods };
  }
}
