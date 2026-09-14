import {
  createCacheMetrics,
  createCounter,
  createHistogram,
  createLogger,
  createMetricsRegistry,
} from "@repo/monitoring";

export const logger = createLogger("inventory-service");
export const metrics = createMetricsRegistry("inventory-service");
export const cacheMetrics = createCacheMetrics(metrics);

export const inventoryMetrics = {
  // Counters for reservation lifecycle
  reservationsCreatedTotal: createCounter(
    metrics,
    "inventory_reservations_created_total",
    "Total number of inventory reservations created",
  ),
  reservationsConfirmedTotal: createCounter(
    metrics,
    "inventory_reservations_confirmed_total",
    "Total number of inventory reservations confirmed into sales",
  ),
  reservationsReleasedTotal: createCounter(
    metrics,
    "inventory_reservations_released_total",
    "Total number of inventory reservations released back to availability",
  ),
  reservationsExpiredTotal: createCounter(
    metrics,
    "inventory_reservations_expired_total",
    "Total number of inventory reservations expired and released",
  ),

  // Stock mutations
  restocksTotal: createCounter(
    metrics,
    "inventory_restocks_total",
    "Total number of inventory restock operations",
  ),
  adjustmentsTotal: createCounter(
    metrics,
    "inventory_adjustments_total",
    "Total number of inventory adjustment operations",
  ),

  // Oversell prevention & alerts
  oversellPreventedTotal: createCounter(
    metrics,
    "inventory_oversell_prevented_total",
    "Total number of reservation/deduction attempts rejected due to insufficient stock",
  ),
  lowStockAlertsTotal: createCounter(
    metrics,
    "inventory_low_stock_alerts_total",
    "Total number of low or out-of-stock alert events triggered",
  ),

  // Latency histograms
  operationDurationSeconds: createHistogram(
    metrics,
    "inventory_operation_duration_seconds",
    "Duration of inventory operations in seconds",
  ),
};
