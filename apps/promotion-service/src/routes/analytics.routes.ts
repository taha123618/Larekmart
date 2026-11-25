import { Hono } from "hono";
import { shouldBeAdmin, shouldBeUser } from "../middleware/auth.middleware.js";
import {
  AttributionEventSchema,
  BudgetForecastSchema,
  StackingPolicySchema,
  forecastCampaignBudget,
  getCampaignAnalytics,
  getStackingPolicy,
  recordCampaignAttribution,
  setStackingPolicy,
} from "../services/promotion-analytics.service.js";

const promotionAnalyticsRoutes = new Hono();

promotionAnalyticsRoutes.post("/attribution", shouldBeUser, async (c) => {
  const parsed = AttributionEventSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ message: "Invalid attribution payload", issues: parsed.error.issues }, 400);
  }
  const event = recordCampaignAttribution(parsed.data);
  return c.json({ event }, 201);
});

promotionAnalyticsRoutes.get("/:campaignId/analytics", shouldBeUser, (c) => {
  return c.json(getCampaignAnalytics(c.req.param("campaignId")));
});

promotionAnalyticsRoutes.put("/:campaignId/stacking-policy", shouldBeAdmin, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = StackingPolicySchema.safeParse({
    ...body,
    campaignId: c.req.param("campaignId"),
  });
  if (!parsed.success) {
    return c.json({ message: "Invalid stacking policy", issues: parsed.error.issues }, 400);
  }
  return c.json({ policy: setStackingPolicy(parsed.data) });
});

promotionAnalyticsRoutes.get("/:campaignId/stacking-policy", shouldBeUser, (c) => {
  const policy = getStackingPolicy(c.req.param("campaignId"));
  if (!policy) return c.json({ message: "Stacking policy not found" }, 404);
  return c.json({ policy });
});

promotionAnalyticsRoutes.post("/:campaignId/forecast", shouldBeUser, async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = BudgetForecastSchema.safeParse({
    ...body,
    campaignId: c.req.param("campaignId"),
  });
  if (!parsed.success) {
    return c.json({ message: "Invalid forecast payload", issues: parsed.error.issues }, 400);
  }
  return c.json(forecastCampaignBudget(parsed.data));
});

export default promotionAnalyticsRoutes;
