import { Order } from "@repo/order-db";
import {
  OrderType,
  OrderConfirmedPayload,
  PaymentRefundRequestedPayload,
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

    const orderDoc = {
      userId: orderPayload.userId,
      email: orderPayload.email,
      amount: orderPayload.amount,
      taxAmount: orderPayload.taxAmount ?? 0,
      taxCalculationId: orderPayload.taxCalculationId ?? null,
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
      `Order initialized in PENDING_CONFIRMATION with ID: ${savedOrder._id}`,
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
 * 2. Saga Confirmation Phase: Confirm order when inventory-service sells reserved stock
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

    order.status = "confirmed";
    (order as any).sagaHistory.push({
      state: "confirmed",
      trigger: "inventory.stock.sold",
      timestamp: new Date(),
    });

    await order.save();
    logger.info(`Order ${order._id} transitioned to CONFIRMED.`);

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

    // Emit order.confirmed to trigger cart conversion and shipping creation
    await producer.send("order.confirmed", { value: confirmedPayload });
  } catch (err) {
    logger.error("Error confirming order during checkout saga:", err);
  }
};

/**
 * 3. Saga Compensation Phase: Cancel order and request refund if inventory reservation failed
 */
export const cancelOutOfStockOrder = async (failedPayload: any) => {
  const { reservationId, referenceId, reason, details } = failedPayload;
  logger.warn(
    `Triggering Saga compensation for failed reservation: ${reservationId}, reference: ${referenceId} (${reason})`,
  );

  try {
    const query = reservationId
      ? { reservationId, status: "pending_confirmation" }
      : { paymentSessionId: referenceId, status: "pending_confirmation" };

    const order = await Order.findOne(query);
    if (!order) {
      logger.info(
        `No pending_confirmation order found to compensate for reservation ${reservationId}`,
      );
      return;
    }

    order.status = "cancelled_out_of_stock";
    (order as any).sagaHistory.push({
      state: "cancelled_out_of_stock",
      trigger: "inventory.reservation.failed",
      error: details || reason,
      timestamp: new Date(),
    });

    await order.save();
    logger.warn(
      `Order ${order._id} cancelled due to out-of-stock. Emitting payment.refund.requested...`,
    );

    const refundPayload: PaymentRefundRequestedPayload = {
      orderId: order._id.toString(),
      paymentSessionId: (order as any).paymentSessionId || referenceId,
      amount: order.amount,
      reason: details || `Stock reservation failed: ${reason}`,
      userId: order.userId,
      requestedAt: new Date().toISOString(),
    };

    await producer.send("payment.refund.requested", { value: refundPayload });
  } catch (err) {
    logger.error("Error executing Saga compensation for cancelled order:", err);
  }
};

/**
 * 4. Saga Terminal Phase: Mark order as refunded once Stripe refund succeeds
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
