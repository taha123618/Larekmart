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

  // Payment verification (Stripe cross-check on payment.successful)
  paymentVerificationRejectedTotal: createCounter(
    metrics,
    "inventory_payment_verification_rejected_total",
    "Total number of payment.successful events rejected by Stripe paid-session verification",
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
  gatekeeperFastRejectsTotal: createCounter(
    metrics,
    "inventory_gatekeeper_fast_rejects_total",
    "Total number of reservations rejected in Redis before reaching PostgreSQL",
  ),
  gatekeeperClaimsTotal: createCounter(
    metrics,
    "inventory_gatekeeper_claims_total",
    "Total number of reservation claims granted by Redis Gatekeeper",
  ),
  gatekeeperRollbacksTotal: createCounter(
    metrics,
    "inventory_gatekeeper_rollbacks_total",
    "Total number of Redis Gatekeeper stock rollbacks upon database failure",
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
