export interface RateLimitPolicy {
  limit: number;
  windowSeconds: number;
  degraded?: boolean;
}


export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
  AUTH: {
    limit: 15,
    windowSeconds: 60,
  },
  PUBLIC_READ: {
    limit: 300,
    windowSeconds: 60,
  },
  SEARCH: {
    limit: 120,
    windowSeconds: 60,
  },
  WRITE: {
    limit: 60,
    windowSeconds: 60,
  },
  CHECKOUT: {
    limit: 30,
    windowSeconds: 60,
  },
  PAYMENT: {
    limit: 20,
    windowSeconds: 60,
  },
  ADMIN: {
    limit: 60,
    windowSeconds: 60,
  },
  DEFAULT: {
    limit: 100,
    windowSeconds: 60,
  },
};

export const REQUEST_SIZE_LIMITS = {
  DEFAULT_BODY_BYTES: 1024 * 1024, // 1MB for normal JSON payloads
  EXTENDED_BODY_BYTES: 5 * 1024 * 1024, // 5MB for products/catalogs
} as const;

export function getRateLimitForRoute(prefix: string): RateLimitPolicy {
  if (prefix.includes("/auth")) {
    return RATE_LIMIT_POLICIES.AUTH!;
  }
  if (prefix.includes("/payments") || prefix.includes("/sessions")) {
    return RATE_LIMIT_POLICIES.PAYMENT!;
  }
  if (prefix.includes("/checkout")) {
    return RATE_LIMIT_POLICIES.CHECKOUT!;
  }
  if (prefix.includes("/search")) {
    return RATE_LIMIT_POLICIES.SEARCH!;
  }
  if (prefix.includes("/admin")) {
    return RATE_LIMIT_POLICIES.ADMIN!;
  }
  if (prefix.includes("/catalog") || prefix.includes("/products")) {
    return RATE_LIMIT_POLICIES.PUBLIC_READ!;
  }
  return RATE_LIMIT_POLICIES.DEFAULT!;
}

export function getAdaptiveRateLimitForRoute(
  prefix: string,
  isDegraded = false,
): RateLimitPolicy {
  const policy = getRateLimitForRoute(prefix);
  if (!isDegraded) {
    return policy;
  }

  // Under downstream chaos / circuit breaker trips, clamp transactional endpoints
  if (
    prefix.includes("/checkout") ||
    prefix.includes("/payments") ||
    prefix.includes("/sessions")
  ) {
    return {
      limit: Math.min(policy.limit, 5),
      windowSeconds: policy.windowSeconds,
      degraded: true,
    };
  }

  return policy;
}

