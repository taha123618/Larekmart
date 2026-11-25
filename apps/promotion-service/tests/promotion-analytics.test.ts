import assert from "node:assert/strict";
import {
  recordCampaignAttribution,
  getCampaignAnalytics,
  setStackingPolicy,
  getStackingPolicy,
  forecastCampaignBudget,
} from "../src/services/promotion-analytics.service.js";

console.log("=== promotion-service Analytics & Forecasting Tests ===");

recordCampaignAttribution({
  campaignId: "cmp_winter_20",
  orderId: "ord_101",
  userId: "usr_1",
  orderRevenue: 500,
  discountGranted: 100,
  channel: "EMAIL",
});
recordCampaignAttribution({
  campaignId: "cmp_winter_20",
  orderId: "ord_102",
  userId: "usr_2",
  orderRevenue: 300,
  discountGranted: 60,
  channel: "APP_PUSH",
});

const stats = getCampaignAnalytics("cmp_winter_20");
assert.equal(stats.conversions, 2);
assert.equal(stats.totalRevenue, 800);
assert.equal(stats.returnOnDiscountRatio, 5);
console.log("  ✔ Campaign attribution & promotion analytics verified");

const policy = setStackingPolicy({
  campaignId: "cmp_winter_20",
  mode: "PRIORITY_ORDER",
  priority: 1,
  maxCombinedDiscountPercent: 35,
});
assert.equal(getStackingPolicy("cmp_winter_20")?.mode, "PRIORITY_ORDER");
assert.equal(policy.maxCombinedDiscountPercent, 35);
console.log("  ✔ Stacking policy configuration verified");

const forecast = forecastCampaignBudget({
  campaignId: "cmp_winter_20",
  totalBudget: 1000,
  budgetUsed: 800,
  daysElapsed: 4,
});
assert.equal(forecast.dailyBurnRate, 200);
assert.equal(forecast.projectedDaysRemaining, 1);
assert.equal(forecast.riskLevel, "CRITICAL");
console.log("  ✔ Budget burn rate & exhaustion forecasting verified");
