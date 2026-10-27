import { Order } from "@repo/order-db";
import {
  OrderType,
  OrderConfirmedPayload,
  PaymentRefundRequestedPayload,
  OrderCancelledPayload,
  TaxCalculationCompletedEventPayload,
  TaxCalculationFailedEventPayload,
  TaxCalculationVoidedEventPayload,
  InventoryReservationCancelledPayload,
} from "@repo/types";
import { producer } from "./kafka";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

const logger = createLogger("order-service:saga-orchestrator");

/**
 * 1. Initial Saga Phase: Create Order in PENDING_CONFIRMATION upon payment.successful
 */
export const createOrder = async (orderPayload: any) => {
  const sessionId = orderPayload.sessionId || orderPayload.referenceId || null;
  const reservationId = orderPayload.reservationId || null;

  try {
    // Idempotency check: if order with this paymentSessionId already exists, do not recreate
    if (sessionId) {
      const existing = await Order.findOne({ paymentSessionId: sessionId });
      if (existing) {
        logger.info(
          `Order already exists for paymentSessionId: ${sessionId} (Order ID: ${existing._id})`,
        );
        return existing;
      }
    }

    const hasTaxCalculation = Boolean(orderPayload.taxCalculationId);

    const orderDoc = {
      userId: orderPayload.userId,
      email: orderPayload.email,
      amount: orderPayload.amount,
      taxAmount: orderPayload.taxAmount ?? 0,
      taxCalculationId: orderPayload.taxCalculationId ?? null,
      taxStatus: hasTaxCalculation ? "pending" : "completed",
      inventoryStatus: "pending",
      status: "pending_confirmation",
      paymentMethod: orderPayload.paymentMethod || "card",
      isCod: orderPayload.isCod || false,
      sellerId: orderPayload.sellerId || null,
      vendorId: orderPayload.vendorId || null,
      carrier: orderPayload.carrier || "custom",
      trackingNumber: null,
      paymentSessionId: sessionId,
      reservationId: reservationId,
      refundId: null,
      sagaHistory: [
        {
          state: "pending_confirmation",
          trigger: "payment.successful",
          timestamp: new Date(),
        },
      ],
      shippingAddress: orderPayload.shippingAddress || null,
      products: orderPayload.products || [],
    };

    const newOrder = new Order(orderDoc);

    const { result: savedOrder } = await measureAsync(
      "db.order.save",
      async () => {
        return await newOrder.save();
      },
    );

    logger.info(
      `Order initialized in PENDING_CONFIRMATION with ID: ${savedOrder._id} (TaxStatus: ${orderDoc.taxStatus}, InvStatus: pending)`,
    );

    await producer.send("order.created", {
      value: {
        orderId: savedOrder._id.toString(),
        userId: savedOrder.userId,
        cartId: orderPayload.cartId || null,
        reservationId: reservationId,
        paymentSessionId: sessionId,
        couponCode: orderPayload.couponCode || null,
        taxCalculationId: savedOrder.taxCalculationId || null,
        taxAmount: savedOrder.taxAmount ?? 0,
        email: savedOrder.email,
        amount: savedOrder.amount,
        status: savedOrder.status,
        products: savedOrder.products,
      },
    });

    return savedOrder;
  } catch (error) {
    captureError(error, {
      serviceName: "order-service",
      logger,
      context: "createOrder",
    });
    throw error;
  }
};

/**
 * 2. Saga Confirmation Phase: Handle inventory-service confirmation (PostgreSQL)
 */
export const confirmOrder = async (inventorySoldPayload: any) => {
  const { reservationId, referenceId } = inventorySoldPayload;
  logger.info(
    `Received inventory confirmation for reservation: ${reservationId}, reference: ${referenceId}`,
  );

  try {
    const query = reservationId
      ? { reservationId, status: "pending_confirmation" }
      : { paymentSessionId: referenceId, status: "pending_confirmation" };

    const order = await Order.findOne(query);
    if (!order) {
      logger.info(
        `No pending_confirmation order found matching reservation ${reservationId} or reference ${referenceId}`,
      );
      return;
    }

    (order as any).inventoryStatus = "sold";

    // Dual-ACK check: Has tax settled (or does not require tax)?
    const isTaxSettled =
      !(order as any).taxCalculationId ||
      (order as any).taxStatus === "completed";

    if (isTaxSettled) {
      order.status = "confirmed";
      (order as any).sagaHistory.push({
        state: "confirmed",
        trigger: "inventory.stock.sold",
        timestamp: new Date(),
      });

      await order.save();
      logger.info(
        `Order ${order._id} Dual-ACK achieved: transitioned to CONFIRMED.`,
      );

      const confirmedPayload: OrderConfirmedPayload = {
        orderId: order._id.toString(),
        userId: order.userId,
        email: order.email,
        paymentSessionId: (order as any).paymentSessionId,
        reservationId: (order as any).reservationId,
        amount: order.amount,
        products: order.products,
        shippingAddress: (order as any).shippingAddress,
        confirmedAt: new Date().toISOString(),
      };

      await producer.send("order.confirmed", { value: confirmedPayload });
    } else {
      (order as any).sagaHistory.push({
        state: "pending_confirmation",
        trigger: "inventory.stock.sold (awaiting tax completion)",
        timestamp: new Date(),
      });
      await order.save();
      logger.info(
        `Order ${order._id} inventory sold; waiting for tax calculation confirmation.`,
      );
    }
  } catch (err) {
    logger.error("Error confirming inventory during checkout saga:", err);
  }
};

/**
 * 3. Saga Confirmation Phase: Handle tax-service confirmation (MySQL)
 */
export const handleTaxCompleted = async (
  taxPayload: TaxCalculationCompletedEventPayload,
) => {
  const { calculationId, referenceId } = taxPayload;
  logger.info(
    `Received tax settlement for calculation: ${calculationId}, reference: ${referenceId}`,
  );

  try {
    const query = referenceId
      ? { _id: referenceId, status: "pending_confirmation" }
      : { taxCalculationId: calculationId, status: "pending_confirmation" };

    const order = await Order.findOne(query);
    if (!order) {
      logger.info(
        `No pending_confirmation order found matching tax calculation ${calculationId} / reference ${referenceId}`,
      );
      return;
    }

    (order as any).taxStatus = "completed";

    // Dual-ACK check: Has inventory sold?
    const isInventorySold = (order as any).inventoryStatus === "sold";

    if (isInventorySold) {
      order.status = "confirmed";
      (order as any).sagaHistory.push({
        state: "confirmed",
        trigger: "tax.calculation.completed",
        timestamp: new Date(),
      });

      await order.save();
      logger.info(
        `Order ${order._id} Dual-ACK achieved: transitioned to CONFIRMED.`,
      );

      const confirmedPayload: OrderConfirmedPayload = {
        orderId: order._id.toString(),
        userId: order.userId,
        email: order.email,
        paymentSessionId: (order as any).paymentSessionId,
        reservationId: (order as any).reservationId,
        amount: order.amount,
        products: order.products,
        shippingAddress: (order as any).shippingAddress,
        confirmedAt: new Date().toISOString(),
      };

      await producer.send("order.confirmed", { value: confirmedPayload });
    } else {
      (order as any).sagaHistory.push({
        state: "pending_confirmation",
        trigger: "tax.calculation.completed (awaiting inventory stock sold)",
        timestamp: new Date(),
      });
      await order.save();
      logger.info(
        `Order ${order._id} tax settled; waiting for inventory stock sale.`,
      );
    }
  } catch (err) {
    logger.error("Error confirming tax settlement during checkout saga:", err);
  }
};

/**
 * 4. Saga Compensation Phase: Handle tax calculation failure (MySQL)
 */
export const handleTaxFailed = async (
  taxFailedPayload: TaxCalculationFailedEventPayload,
) => {
  const { calculationId, referenceId, error } = taxFailedPayload;
  logger.warn(
    `Triggering Saga compensation for failed tax calculation: ${calculationId}, reference: ${referenceId} (${error})`,
  );

  try {
    const query = referenceId
      ? { _id: referenceId, status: "pending_confirmation" }
      : { taxCalculationId: calculationId, status: "pending_confirmation" };

    const order = await Order.findOne(query);
    if (!order) {
      logger.info(
        `No pending_confirmation order found to compensate for tax failure ${calculationId} / ${referenceId}`,
      );
      return;
    }

    order.status = "cancelled_tax_mismatch";
    (order as any).taxStatus = "failed";
    (order as any).sagaHistory.push({
      state: "cancelled_tax_mismatch",
      trigger: "tax.calculation.failed",
      error: error || "Tax calculation snapshot failed or mismatched",
      timestamp: new Date(),
    });

    await order.save();
    logger.warn(
      `Order ${order._id} cancelled due to tax mismatch. Emitting refund and compensating releases...`,
    );

    // 1. Emit Stripe refund request
    const refundPayload: PaymentRefundRequestedPayload = {
      orderId: order._id.toString(),
      paymentSessionId: (order as any).paymentSessionId,
      amount: order.amount,
      reason: `Tax calculation verification failed: ${error}`,
      userId: order.userId,
      requestedAt: new Date().toISOString(),
    };
    await producer.send("payment.refund.requested", { value: refundPayload });

    // 2. Emit order.cancelled
    const cancelledPayload: OrderCancelledPayload = {
      orderId: order._id.toString(),
      userId: order.userId,
      reason: `Tax calculation verification failed: ${error}`,
      cancelledAt: new Date().toISOString(),
    };
    await producer.send("order.cancelled", { value: cancelledPayload });

    // 3. Compensate PostgreSQL inventory (release reservation/stock)
    const invCancelPayload: InventoryReservationCancelledPayload = {
      orderId: order._id.toString(),
      reservationId: (order as any).reservationId,
      referenceId: (order as any).paymentSessionId,
      reason: `Order cancelled due to tax mismatch: ${error}`,
      cancelledAt: new Date().toISOString(),
    };
    await producer.send("inventory.reservation.cancelled", {
      value: invCancelPayload,
    });
  } catch (err) {
    logger.error("Error executing Saga compensation for tax failure:", err);
  }
};

/**
 * 5. Saga Compensation Phase: Cancel order and request refund if inventory reservation failed
 */
export const cancelOutOfStockOrder = async (failedPayload: any) => {
  const { reservationId, referenceId, orderId, reason, details } =
    failedPayload;
  logger.warn(
    `Triggering Saga compensation for failed reservation: ${reservationId}, reference: ${referenceId}, order: ${orderId} (${reason})`,
  );

  try {
    const query = orderId
      ? { _id: orderId, status: "pending_confirmation" }
      : reservationId
        ? { reservationId, status: "pending_confirmation" }
        : { paymentSessionId: referenceId, status: "pending_confirmation" };

    const order = await Order.findOne(query);
    if (!order) {
      logger.info(
        `No pending_confirmation order found to compensate for reservation ${reservationId} or order ${orderId}`,
      );
      return;
    }

    order.status = "cancelled_out_of_stock";
    (order as any).inventoryStatus = "failed";
    (order as any).sagaHistory.push({
      state: "cancelled_out_of_stock",
      trigger: "inventory.reservation.failed",
      error: details || reason,
      timestamp: new Date(),
    });

    await order.save();
    logger.warn(
      `Order ${order._id} cancelled due to out-of-stock. Emitting refund, order.cancelled, and tax void...`,
    );

    // 1. Emit refund request
    const refundPayload: PaymentRefundRequestedPayload = {
      orderId: order._id.toString(),
      paymentSessionId: (order as any).paymentSessionId || referenceId,
      amount: order.amount,
      reason: details || `Stock reservation failed: ${reason}`,
      userId: order.userId,
      requestedAt: new Date().toISOString(),
    };
    await producer.send("payment.refund.requested", { value: refundPayload });

    // 2. Emit order.cancelled
    const cancelledPayload: OrderCancelledPayload = {
      orderId: order._id.toString(),
      userId: order.userId,
      reason: details || `Stock reservation failed: ${reason}`,
      cancelledAt: new Date().toISOString(),
    };
    await producer.send("order.cancelled", { value: cancelledPayload });

    // 3. Compensate MySQL tax calculation (void calculation snapshot)
    if ((order as any).taxCalculationId) {
      const taxVoidPayload: TaxCalculationVoidedEventPayload = {
        calculationId: (order as any).taxCalculationId,
        referenceId: order._id.toString(),
        referenceType: "voided",
        reason: details || `Inventory reservation failed: ${reason}`,
        voidedAt: new Date().toISOString(),
      };
      await producer.send("tax.calculation.voided", { value: taxVoidPayload });
    }
  } catch (err) {
    logger.error("Error executing Saga compensation for cancelled order:", err);
  }
};

/**
 * 6. Saga Terminal Phase: Mark order as refunded once Stripe refund succeeds
 */
export const markOrderRefunded = async (refundPayload: any) => {
  const { orderId, refundId, paymentSessionId } = refundPayload;
  try {
    const query = orderId ? { _id: orderId } : { paymentSessionId };

    const order = await Order.findOne(query);
    if (order) {
      order.status = "refunded";
      (order as any).refundId = refundId;
      (order as any).sagaHistory.push({
        state: "refunded",
        trigger: "payment.refund.completed",
        timestamp: new Date(),
      });
      await order.save();
      logger.info(
        `Order ${order._id} marked REFUNDED with refund ID: ${refundId}`,
      );
    }
  } catch (err) {
    logger.error("Error marking order refunded:", err);
  }
};

/**
 * 7. Saga Resilience: Sweeper for pending_confirmation orders that timed out
 */
export const processPendingConfirmationTimeouts = async (
  timeoutMs = 60000,
): Promise<number> => {
  const threshold = new Date(Date.now() - timeoutMs);
  const stuckOrders = await Order.find({
    status: "pending_confirmation",
    createdAt: { $lte: threshold },
  });

  if (stuckOrders.length === 0) return 0;

  logger.warn(
    `Found ${stuckOrders.length} pending_confirmation orders timed out past ${timeoutMs}ms`,
  );

  for (const order of stuckOrders) {
    await cancelOutOfStockOrder({
      orderId: order._id.toString(),
      reservationId: (order as any).reservationId,
      referenceId: (order as any).paymentSessionId,
      reason: "TIMEOUT",
      details: `Dual-ACK confirmation timed out after ${timeoutMs / 1000}s`,
    });
  }

  return stuckOrders.length;
};

export const startPendingConfirmationTimeoutSweeper = (
  intervalMs = 30000,
  timeoutMs = 60000,
): NodeJS.Timeout => {
  const timer = setInterval(async () => {
    try {
      await processPendingConfirmationTimeouts(timeoutMs);
    } catch (err) {
      logger.error(
        "Error executing pending confirmation timeout sweeper:",
        err,
      );
    }
  }, intervalMs);
  timer.unref();
  return timer;
};
