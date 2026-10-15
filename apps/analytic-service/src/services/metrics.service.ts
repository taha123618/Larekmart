import { pool, getDbStatus } from "../db.js";
import type {
  PaymentSuccessfulType,
  OrderCreatedType,
  UserCreatedType,
  StripeProductType,
  AnalyticsSummaryType,
  AnalyticsDailyChartType,
  AnalyticsEventType,
} from "@repo/types";
import { createLogger, captureError } from "@repo/monitoring";
import {
  getCachedDailyChart,
  setCachedDailyChart,
  getCachedEvents,
  setCachedEvents,
} from "../cache/analytics-cache.js";

const logger = createLogger("analytic-service:metrics");

// In-memory aggregates for rapid observation and resilience fallback
const inMemoryMetrics = {
  totalRevenue: 0,
  totalOrders: 0,
  totalSignups: 0,
  totalProductsCreated: 0,
  totalProductsDeleted: 0,
  totalCartsCreated: 0,
  totalCartsUpdated: 0,
  totalCartsExpired: 0,
  totalMediaUploaded: 0,
  totalMediaProcessed: 0,
  totalMediaDeleted: 0,
  lastEventTime: new Date().toISOString(),
};

// In-memory event stream buffer (last 100 events)
const inMemoryEvents: AnalyticsEventType[] = [];

export const recordMediaEvent = async (
  eventType:
    | "media.uploaded"
    | "media.processing_completed"
    | "media.processing_failed"
    | "media.deleted"
    | "media.quarantined",
  payload: any,
) => {
  if (eventType === "media.uploaded") inMemoryMetrics.totalMediaUploaded += 1;
  else if (eventType === "media.processing_completed")
    inMemoryMetrics.totalMediaProcessed += 1;
  else if (eventType === "media.deleted")
    inMemoryMetrics.totalMediaDeleted += 1;

  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const userId = payload?.ownerId || payload?.createdBy || "system";

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: String(userId),
    amount: 0,
    metadata: {
      mediaId: payload?.mediaId || payload?.id,
      ownerType: payload?.ownerType,
      ownerId: payload?.ownerId,
      sizeBytes: payload?.sizeBytes,
      mimeType: payload?.mimeType,
    },
    created_at: payload?.occurredAt || new Date().toISOString(),
  };

  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventType,
          String(userId),
          0,
          JSON.stringify(memoryEvent.metadata),
          memoryEvent.created_at,
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordMediaEvent.dbInsert",
      });
    }
  }

  logger.info(
    `[Media Event] ${eventType} for ${userId} (mediaId: ${payload?.mediaId || payload?.id})`,
  );
};

export const recordReviewEvent = async (
  eventType:
    | "review.created"
    | "review.approved"
    | "review.rejected"
    | "review.reported"
    | "product.rating-summary.updated",
  payload: any,
) => {
  const data = payload?.data || payload;
  const userId = data?.userId || data?.moderatorId || "system";
  const amount = data?.rating || data?.averageRating || 0;

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: String(userId),
    amount,
    metadata: {
      reviewId: data?.reviewId,
      productId: data?.productId,
      rating: data?.rating,
      averageRating: data?.averageRating,
      reviewCount: data?.reviewCount,
      reason: data?.reason,
    },
    created_at: payload?.timestamp || new Date().toISOString(),
  };

  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventType,
          String(userId),
          amount,
          JSON.stringify(memoryEvent.metadata),
          memoryEvent.created_at,
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordReviewEvent.dbInsert",
      });
    }
  }

  logger.info(
    `[Review Event] ${eventType} for ${userId} (productId: ${data?.productId})`,
  );
};

export const recordWishlistEvent = async (
  eventType:
    | "wishlist.created"
    | "wishlist.item.added"
    | "wishlist.item.removed"
    | "wishlist.merged"
    | "wishlist.price-drop.alert"
    | "wishlist.restock.alert",
  payload: any,
) => {
  const data = payload?.data || payload;
  const userId = data?.userId || data?.guestId || "system";
  const amount =
    (data?.priceAtAdditionInPaisa ? data.priceAtAdditionInPaisa / 100 : 0) ||
    (data?.newPriceInPaisa ? data.newPriceInPaisa / 100 : 0) ||
    0;

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: String(userId),
    amount,
    metadata: {
      wishlistId: data?.wishlistId,
      productId: data?.productId,
      variantId: data?.variantId,
      priceAtAdditionInPaisa: data?.priceAtAdditionInPaisa,
      newPriceInPaisa: data?.newPriceInPaisa,
      mergedCount: data?.mergedCount,
    },
    created_at: payload?.timestamp || new Date().toISOString(),
  };

  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventType,
          String(userId),
          amount,
          JSON.stringify(memoryEvent.metadata),
          memoryEvent.created_at,
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordWishlistEvent.dbInsert",
      });
    }
  }

  logger.info(
    `[Wishlist Event] ${eventType} for ${userId} (wishlistId: ${data?.wishlistId})`,
  );
};

export const recordPromotionEvent = async (
  eventType:
    | "promotion.created"
    | "promotion.activated"
    | "promotion.deactivated"
    | "promotion.reserved"
    | "promotion.redeemed"
    | "promotion.reservation.released"
    | "promotion.budget_exhausted",
  payload: any,
) => {
  const data = payload?.data || payload;
  const userId = data?.userId || data?.guestId || "system";
  const amount = Number(data?.discountAmount || 0);

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: String(userId),
    amount,
    metadata: {
      promotionId: data?.promotionId,
      reservationId: data?.reservationId,
      redemptionId: data?.redemptionId,
      orderId: data?.orderId,
      discountAmount: data?.discountAmount,
      name: data?.name,
      type: data?.type,
      status: data?.status,
    },
    created_at: payload?.timestamp || new Date().toISOString(),
  };

  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          eventType,
          String(userId),
          amount,
          JSON.stringify(memoryEvent.metadata),
          memoryEvent.created_at,
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordPromotionEvent.dbInsert",
      });
    }
  }

  logger.info(`[Promotion Event] ${eventType} recorded`, {
    promotionId: data?.promotionId,
    discountAmount: amount,
    userId,
  });
};

export const recordCartEvent = async (
  eventType:
    | "cart.created"
    | "cart.updated"
    | "cart.merged"
    | "cart.expired"
    | "cart.cleared",
  payload: any,
) => {
  if (eventType === "cart.created") inMemoryMetrics.totalCartsCreated += 1;
  else if (eventType === "cart.updated") inMemoryMetrics.totalCartsUpdated += 1;
  else if (eventType === "cart.expired") inMemoryMetrics.totalCartsExpired += 1;

  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const userId = payload.userId || payload.guestToken || "anonymous";
  const amount = payload.pricing?.grandTotal || 0;

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: userId,
    amount: typeof amount === "number" ? amount : 0,
    metadata: {
      cartId: payload.cartId || payload.id,
      guestToken: payload.guestToken,
      itemsCount: payload.items?.length || 0,
    },
    created_at: new Date().toISOString(),
  };

  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(`[Cart Event] ${eventType} for ${userId} (amount: $${amount})`);
};

export const recordPayment = async (payload: PaymentSuccessfulType) => {
  const amountInDollars = payload.amount ? payload.amount / 100 : 0;
  const userId = payload.userId || "anonymous";

  inMemoryMetrics.totalRevenue += amountInDollars;
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: "payment.successful",
    user_id: userId,
    amount: amountInDollars,
    metadata: {
      email: payload.email,
      status: payload.status,
      products: payload.products,
    },
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(
    `[Payment] User ${userId} paid $${amountInDollars.toFixed(2)} (${payload.products?.length || 0} items)`,
  );

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          "payment.successful",
          userId,
          amountInDollars,
          JSON.stringify({
            email: payload.email,
            status: payload.status,
            products: payload.products,
          }),
        ],
      );

      await pool.query(
        `INSERT INTO analytics_daily_summary (date, total_revenue)
         VALUES (CURRENT_DATE, $1)
         ON CONFLICT (date) DO UPDATE
         SET total_revenue = analytics_daily_summary.total_revenue + $1,
             updated_at = CURRENT_TIMESTAMP`,
        [amountInDollars],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordPayment.dbInsert",
      });
    }
  }
};

export const recordOrder = async (payload: OrderCreatedType) => {
  const amountInDollars = payload.amount ? payload.amount / 100 : 0;

  inMemoryMetrics.totalOrders += 1;
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: "order.created",
    user_id: payload.email,
    amount: amountInDollars,
    metadata: { status: payload.status },
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(
    `[Order] Email ${payload.email} for $${amountInDollars.toFixed(2)} (Status: ${payload.status})`,
  );

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          "order.created",
          payload.email,
          amountInDollars,
          JSON.stringify({ status: payload.status }),
        ],
      );

      await pool.query(
        `INSERT INTO analytics_daily_summary (date, total_orders)
         VALUES (CURRENT_DATE, 1)
         ON CONFLICT (date) DO UPDATE
         SET total_orders = analytics_daily_summary.total_orders + 1,
             updated_at = CURRENT_TIMESTAMP`,
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordOrder.dbInsert",
      });
    }
  }
};

export const recordUserSignup = async (payload: UserCreatedType) => {
  inMemoryMetrics.totalSignups += 1;
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: "user.created",
    user_id: payload.email,
    amount: null,
    metadata: { username: payload.username },
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(`[User Signup] ${payload.username} (${payload.email})`);

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, metadata)
         VALUES ($1, $2, $3)`,
        [
          "user.created",
          payload.email,
          JSON.stringify({ username: payload.username }),
        ],
      );

      await pool.query(
        `INSERT INTO analytics_daily_summary (date, total_signups)
         VALUES (CURRENT_DATE, 1)
         ON CONFLICT (date) DO UPDATE
         SET total_signups = analytics_daily_summary.total_signups + 1,
             updated_at = CURRENT_TIMESTAMP`,
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordUserSignup.dbInsert",
      });
    }
  }
};

export const recordProductCreated = async (payload: StripeProductType) => {
  inMemoryMetrics.totalProductsCreated += 1;
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: "product.created",
    user_id: payload.id,
    amount: payload.price,
    metadata: { name: payload.name },
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(
    `[Product Created] ${payload.name} (ID: ${payload.id}, Price: $${payload.price})`,
  );

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          "product.created",
          payload.id,
          payload.price,
          JSON.stringify({ name: payload.name }),
        ],
      );

      await pool.query(
        `INSERT INTO analytics_daily_summary (date, total_products_created)
         VALUES (CURRENT_DATE, 1)
         ON CONFLICT (date) DO UPDATE
         SET total_products_created = analytics_daily_summary.total_products_created + 1,
             updated_at = CURRENT_TIMESTAMP`,
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordProductCreated.dbInsert",
      });
    }
  }
};

export const recordProductDeleted = async (productId: number | string) => {
  inMemoryMetrics.totalProductsDeleted += 1;
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: "product.deleted",
    user_id: productId.toString(),
    amount: null,
    metadata: { productId },
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(`[Product Deleted] ID ${productId}`);

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, metadata)
         VALUES ($1, $2, $3)`,
        [
          "product.deleted",
          productId.toString(),
          JSON.stringify({ productId }),
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordProductDeleted.dbInsert",
      });
    }
  }
};

export const recordInventoryEvent = async (
  eventType: string,
  payload: {
    productId?: number;
    quantity?: number;
    availableQuantity?: number;
    reservedQuantity?: number;
    soldQuantity?: number;
    warehouseId?: string;
    variantId?: string;
    reason?: string;
  },
) => {
  inMemoryMetrics.lastEventTime = new Date().toISOString();

  const memoryEvent: AnalyticsEventType = {
    id: inMemoryEvents.length + 1,
    event_type: eventType,
    user_id: payload.productId ? payload.productId.toString() : null,
    amount: payload.quantity ?? null,
    metadata: payload as Record<string, unknown>,
    created_at: new Date().toISOString(),
  };
  inMemoryEvents.unshift(memoryEvent);
  if (inMemoryEvents.length > 100) inMemoryEvents.pop();

  logger.info(
    `[Inventory Event] ${eventType} for Product ID ${payload.productId ?? "N/A"} (Qty: ${payload.quantity ?? "N/A"})`,
  );

  if (getDbStatus()) {
    try {
      await pool.query(
        `INSERT INTO analytics_events (event_type, user_id, amount, metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          eventType,
          payload.productId ? payload.productId.toString() : null,
          payload.quantity ?? null,
          JSON.stringify(payload),
        ],
      );
    } catch (err) {
      captureError(err, {
        serviceName: "analytic-service",
        logger,
        context: "recordInventoryEvent.dbInsert",
      });
    }
  }
};

export const getMetricsSnapshot = (): AnalyticsSummaryType => ({
  ...inMemoryMetrics,
  isDbConnected: getDbStatus(),
});

/**
 * Reads daily aggregations from PostgreSQL, falling back to today's in-memory
 * snapshot when the database is unavailable. Not exported — callers go through
 * `getDailyAnalytics`, which adds the Redis read-through cache.
 */
const readDailyAnalytics = async (
  days: number,
): Promise<AnalyticsDailyChartType[]> => {
  if (getDbStatus()) {
    try {
      const safeDays = Math.min(
        Math.max(1, Math.floor(Number(days) || 30)),
        365,
      );
      const result = await pool.query(
        `SELECT
          TO_CHAR(date, 'YYYY-MM-DD') as date,
          COALESCE(total_revenue, 0)::numeric as total_revenue,
          COALESCE(total_orders, 0)::int as total_orders,
          COALESCE(total_signups, 0)::int as total_signups,
          COALESCE(total_products_created, 0)::int as total_products_created
         FROM analytics_daily_summary
         WHERE date >= CURRENT_DATE - ($1 * INTERVAL '1 day')
         ORDER BY date ASC`,
        [safeDays],
      );

      return result.rows.map((row) => ({
        date: row.date,
        total_revenue: Number(row.total_revenue),
        total_orders: Number(row.total_orders),
        total_signups: Number(row.total_signups),
        total_products_created: Number(row.total_products_created),
      }));
    } catch (error) {
      captureError(error, {
        serviceName: "analytic-service",
        logger,
        context: "getDailyAnalytics",
      });
    }
  }

  // Fallback: return today's in-memory data
  const today = new Date().toISOString().split("T")[0] || "today";
  return [
    {
      date: today,
      total_revenue: inMemoryMetrics.totalRevenue,
      total_orders: inMemoryMetrics.totalOrders,
      total_signups: inMemoryMetrics.totalSignups,
      total_products_created: inMemoryMetrics.totalProductsCreated,
    },
  ];
};

/**
 * Returns daily aggregation rows for the last `days` days, served from Redis
 * when available. Cached entries are TTL-bounded, not invalidated on write —
 * see `src/cache/analytics-cache.ts` for why.
 */
export const getDailyAnalytics = async (
  days = 30,
): Promise<AnalyticsDailyChartType[]> => {
  const cached = await getCachedDailyChart(days);
  if (cached) return cached;

  const data = await readDailyAnalytics(days);
  await setCachedDailyChart(days, data);
  return data;
};

/**
 * Reads the recent audit event stream from PostgreSQL, falling back to the
 * in-memory buffer. Not exported — callers go through `getRecentEvents`.
 */
const readRecentEvents = async (
  limit: number,
): Promise<AnalyticsEventType[]> => {
  if (getDbStatus()) {
    try {
      const result = await pool.query(
        `SELECT id, event_type, user_id, amount, metadata, created_at
         FROM analytics_events
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit],
      );

      return result.rows.map((row) => ({
        id: row.id,
        event_type: row.event_type,
        user_id: row.user_id,
        amount: row.amount ? Number(row.amount) : null,
        metadata:
          typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata || {},
        created_at: row.created_at,
      }));
    } catch (error) {
      captureError(error, {
        serviceName: "analytic-service",
        logger,
        context: "getRecentEvents",
      });
    }
  }

  return inMemoryEvents.slice(0, limit);
};

/**
 * Returns the most recent audit events (newest first), served from Redis when
 * available. Cached entries are TTL-bounded — see `src/cache/analytics-cache.ts`.
 */
export const getRecentEvents = async (
  limit = 20,
): Promise<AnalyticsEventType[]> => {
  const cached = await getCachedEvents(limit);
  if (cached) return cached;

  const events = await readRecentEvents(limit);
  await setCachedEvents(limit, events);
  return events;
};
