import {
  createLogger,
  createMetricsRegistry,
  type MetricsRegistry,
} from "@repo/monitoring";

export const logger = createLogger("promotion-service");

export const metrics: MetricsRegistry =
  createMetricsRegistry("promotion-service");

export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
) => {
  metrics.recordHttpRequest(method, route, statusCode, durationMs);
};

export const recordPromotionOperation = (operation: string) => {
  metrics.increment("promotion_operations_total", 1, { operation });
};

export const recordPromotionReservation = (promotionId: string) => {
  metrics.increment("promotion_reservations_total", 1, { promotionId });
};

export const recordPromotionRedemption = (promotionId: string) => {
  metrics.increment("promotion_redemptions_total", 1, { promotionId });
};

export const recordBudgetExhausted = (promotionId: string) => {
  metrics.increment("promotion_budget_exhausted_total", 1, { promotionId });
};
