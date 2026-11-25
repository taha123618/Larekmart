import { z } from "zod";

export type StackingPolicyMode = "EXCLUSIVE" | "STACKABLE" | "PRIORITY_ORDER";

export interface CampaignAttributionEvent {
  attributionId: string;
  campaignId: string;
  orderId: string;
  userId: string;
  orderRevenue: number;
  discountGranted: number;
  channel: string;
  createdAt: string;
}

export interface StackingPolicyConfig {
  campaignId: string;
  mode: StackingPolicyMode;
  priority: number;
  maxCombinedDiscountPercent: number;
  updatedAt: string;
}

export const AttributionEventSchema = z.object({
  campaignId: z.string().min(1),
  orderId: z.string().min(1),
  userId: z.string().min(1),
  orderRevenue: z.number().nonnegative(),
  discountGranted: z.number().nonnegative(),
  channel: z.string().min(1).default("DIRECT"),
});

export const StackingPolicySchema = z.object({
  campaignId: z.string().min(1),
  mode: z.enum(["EXCLUSIVE", "STACKABLE", "PRIORITY_ORDER"]),
  priority: z.number().int().min(1).max(100).default(10),
  maxCombinedDiscountPercent: z.number().min(1).max(90).default(40),
});

export const BudgetForecastSchema = z.object({
  campaignId: z.string().min(1),
  totalBudget: z.number().positive(),
  budgetUsed: z.number().nonnegative(),
  daysElapsed: z.number().positive(),
});

const attributionLedger: CampaignAttributionEvent[] = [];
const stackingPolicies = new Map<string, StackingPolicyConfig>();

export function recordCampaignAttribution(
  input: z.infer<typeof AttributionEventSchema>,
): CampaignAttributionEvent {
  const evt: CampaignAttributionEvent = {
    attributionId: `attr_${crypto.randomUUID().slice(0, 12)}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  attributionLedger.push(evt);
  return evt;
}

export function getCampaignAnalytics(campaignId: string) {
  const events = attributionLedger.filter((e) => e.campaignId === campaignId);
  const totalRevenue = events.reduce((s, e) => s + e.orderRevenue, 0);
  const totalDiscount = events.reduce((s, e) => s + e.discountGranted, 0);
  const roas = totalDiscount > 0 ? Number((totalRevenue / totalDiscount).toFixed(2)) : 0;

  return {
    campaignId,
    conversions: events.length,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalDiscountGranted: Number(totalDiscount.toFixed(2)),
    netRevenue: Number((totalRevenue - totalDiscount).toFixed(2)),
    returnOnDiscountRatio: roas,
  };
}

export function setStackingPolicy(
  input: z.infer<typeof StackingPolicySchema>,
): StackingPolicyConfig {
  const cfg: StackingPolicyConfig = {
    ...input,
    updatedAt: new Date().toISOString(),
  };
  stackingPolicies.set(input.campaignId, cfg);
  return cfg;
}

export function getStackingPolicy(campaignId: string): StackingPolicyConfig | null {
  return stackingPolicies.get(campaignId) ?? null;
}

export function forecastCampaignBudget(input: z.infer<typeof BudgetForecastSchema>) {
  const remainingBudget = Math.max(0, input.totalBudget - input.budgetUsed);
  const dailyBurnRate = input.budgetUsed / input.daysElapsed;
  const projectedDaysRemaining =
    dailyBurnRate > 0 ? Number((remainingBudget / dailyBurnRate).toFixed(1)) : null;

  return {
    campaignId: input.campaignId,
    totalBudget: input.totalBudget,
    budgetUsed: input.budgetUsed,
    remainingBudget: Number(remainingBudget.toFixed(2)),
    dailyBurnRate: Number(dailyBurnRate.toFixed(2)),
    projectedDaysRemaining,
    riskLevel:
      projectedDaysRemaining !== null && projectedDaysRemaining <= 3
        ? "CRITICAL"
        : projectedDaysRemaining !== null && projectedDaysRemaining <= 7
          ? "WARNING"
          : "HEALTHY",
  };
}
