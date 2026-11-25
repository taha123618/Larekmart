import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { Order } from "@repo/order-db";
import { shouldBeSeller, shouldBeUser } from "../middleware/authMiddleware.js";
import {
  BackorderSchema,
  OrderAmendmentSchema,
  PartialFulfillmentSchema,
  getOrderAmendments,
  getOrderBackorders,
  getOrderFulfillments,
  recordOrderAmendment,
  recordPartialFulfillment,
  registerBackorders,
  splitOrderBySeller,
} from "../services/order-operations.service.js";

/**
 * Registers advanced order operations:
 * - Split orders by seller
 * - Partial fulfillment tracking
 * - Backorder registration & retrieval
 * - Auditable order amendments
 */
export const orderOperationsRoute = async (fastify: FastifyInstance) => {
  fastify.post(
    "/orders/:id/split",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ message: "Invalid order ID format" });
      }
      const order = await Order.findById(id);
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }
      const isAuthorized =
        request.userRole === "admin" ||
        order.userId === request.userId ||
        order.sellerId === request.userId;
      if (!isAuthorized) {
        return reply.status(403).send({ message: "Access forbidden" });
      }

      const splits = splitOrderBySeller({
        items: (order.products || []).map((p: any) => ({
          productId: p.productId ?? p._id ?? "unknown",
          name: p.name,
          sellerId: p.sellerId || order.sellerId || "platform",
          quantity: Number(p.quantity || 1),
          price: Number(p.price || 0),
        })),
        totalTax: Number((order as any).taxAmount || 0),
        totalShipping: Number((order as any).shippingFee || 0),
        defaultSellerId: order.sellerId || "platform",
      });

      return reply.send({ orderId: id, splits });
    },
  );

  fastify.post(
    "/orders/:id/partial-fulfillment",
    { preHandler: shouldBeSeller },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ message: "Invalid order ID format" });
      }
      const parsed = PartialFulfillmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid partial fulfillment payload",
          issues: parsed.error.issues,
        });
      }

      const order = await Order.findById(id);
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      const isAdmin = request.userRole === "admin";
      const isAssignedSeller =
        order.sellerId === request.userId ||
        order.products.some((p: any) => p.sellerId === request.userId);
      if (!isAdmin && !isAssignedSeller) {
        return reply.status(403).send({ message: "Access forbidden" });
      }

      try {
        const result = recordPartialFulfillment({
          orderId: id,
          sellerId: request.userId || "unknown",
          orderItems: (order.products || []).map((p: any) => ({
            productId: String(p.productId ?? p._id ?? ""),
            quantity: Number(p.quantity || 1),
          })),
          fulfillmentItems: parsed.data.items,
          carrier: parsed.data.carrier,
          trackingNumber: parsed.data.trackingNumber,
        });

        order.status = result.isFullyFulfilled ? "shipped" : "processing";
        if (parsed.data.carrier) order.carrier = parsed.data.carrier;
        if (parsed.data.trackingNumber) order.trackingNumber = parsed.data.trackingNumber;
        await order.save();

        return reply.status(201).send(result);
      } catch (err: unknown) {
        return reply.status(400).send({
          message: err instanceof Error ? err.message : "Fulfillment failed",
        });
      }
    },
  );

  fastify.get(
    "/orders/:id/fulfillments",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ orderId: id, fulfillments: getOrderFulfillments(id) });
    },
  );

  fastify.post(
    "/orders/:id/backorders",
    { preHandler: shouldBeSeller },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = BackorderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid backorder payload",
          issues: parsed.error.issues,
        });
      }
      const created = registerBackorders({ orderId: id, items: parsed.data.items });
      return reply.status(201).send({ orderId: id, backorders: created });
    },
  );

  fastify.get(
    "/orders/:id/backorders",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ orderId: id, backorders: getOrderBackorders(id) });
    },
  );

  fastify.post(
    "/orders/:id/amendments",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ message: "Invalid order ID format" });
      }
      const parsed = OrderAmendmentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid amendment payload",
          issues: parsed.error.issues,
        });
      }
      const order = await Order.findById(id);
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      try {
        const record = recordOrderAmendment({
          orderId: id,
          actorId: request.userId || "unknown",
          currentStatus: order.status || "confirmed",
          type: parsed.data.type,
          reason: parsed.data.reason,
          previousValue:
            parsed.data.type === "SHIPPING_ADDRESS"
              ? (order as any).shippingAddress
              : null,
          newValue: parsed.data.newValue,
        });
        return reply.status(201).send({ amendment: record });
      } catch (err: unknown) {
        return reply.status(409).send({
          message: err instanceof Error ? err.message : "Amendment rejected",
        });
      }
    },
  );

  fastify.get(
    "/orders/:id/amendments",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      return reply.send({ orderId: id, amendments: getOrderAmendments(id) });
    },
  );
};
