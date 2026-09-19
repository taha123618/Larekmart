import {
  createCacheMetrics,
  createCounter,
  createHistogram,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

const SERVICE_NAME = "cart-service";

export const logger = createLogger(SERVICE_NAME);
export const metrics = createMetricsRegistry(SERVICE_NAME);
export const cacheMetrics = createCacheMetrics(metrics);

export const cartOperationsCounter = createCounter(
  metrics,
  "cart_operations_total",
  "Total cart lifecycle operations",
);

export const cartItemCountHistogram = createHistogram(
  metrics,
  "cart_items_count",
  "Number of items in cart",
);

export const cartValueHistogram = createHistogram(
  metrics,
  "cart_grand_total_amount",
  "Distribution of cart total values",
);
