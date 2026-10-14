import {
  createLogger,
  createMetricsRegistry,
  type MetricsRegistry,
} from "@repo/monitoring";

export const logger = createLogger("wishlist-service");

export const metrics: MetricsRegistry =
  createMetricsRegistry("wishlist-service");

export const recordHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  durationMs: number,
) => {
  metrics.recordHttpRequest(method, route, statusCode, durationMs);
};

export const recordWishlistOperation = (operation: string) => {
  metrics.increment("wishlist_operations_total", 1, { operation });
};

export const recordPriceDropAlert = (productId: string) => {
  metrics.increment("wishlist_price_drop_alerts_total", 1, { productId });
};

export const recordRestockAlert = (productId: string) => {
  metrics.increment("wishlist_restock_alerts_total", 1, { productId });
};
