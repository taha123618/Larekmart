export const SERVICE_TIMEOUTS = {
  FAST: 3000,       // search-service
  DEFAULT: 5000,    // user, auth, catalog, product, inventory, cart, analytic, notification
  EXTENDED: 10000,  // order, shipping
  CRITICAL: 15000,  // payment, media
} as const;

export function getTimeoutForService(serviceName: string, overrideMs?: number): number {
  if (overrideMs && overrideMs > 0) {
    return overrideMs;
  }

  switch (serviceName) {
    case "search-service":
      return SERVICE_TIMEOUTS.FAST;
    case "order-service":
    case "shipping-service":
      return SERVICE_TIMEOUTS.EXTENDED;
    case "payment-service":
    case "media-service":
      return SERVICE_TIMEOUTS.CRITICAL;
    default:
      return SERVICE_TIMEOUTS.DEFAULT;
  }
}
