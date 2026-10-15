import { Order } from "@repo/order-db";
import { OrderType } from "@repo/types";
import { producer } from "./kafka";
import { createLogger, captureError, measureAsync } from "@repo/monitoring";

const logger = createLogger("order-service:order-creator");

export const createOrder = async (order: OrderType) => {
  const newOrder = new Order(order);

  try {
    const { result: savedOrder } = await measureAsync(
      "db.order.save",
      async () => {
        return await newOrder.save();
      },
    );

    logger.info(`Order created in DB with ID: ${savedOrder._id}`);

    await producer.send("order.created", {
      value: {
        orderId: savedOrder._id.toString(),
        userId: savedOrder.userId,
        cartId: (order as any).cartId || null,
        reservationId: (order as any).reservationId || null,
        couponCode: (order as any).couponCode || null,
        email: savedOrder.email,
        amount: savedOrder.amount,
        status: savedOrder.status,
        products: savedOrder.products,
      },
    });
  } catch (error) {
    captureError(error, {
      serviceName: "order-service",
      logger,
      context: "createOrder",
    });
    throw error;
  }
};
