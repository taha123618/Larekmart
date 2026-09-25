import { FastifyInstance } from "fastify";
import { shouldBeAdmin, shouldBeUser } from "../middleware/authMiddleware";
import { Order } from "@repo/order-db";
import { startOfMonth, subMonths } from "date-fns";
import { OrderChartType } from "@repo/types";
import { createLogger, measureAsync } from "@repo/monitoring";
import {
  getCachedOrderChart,
  setCachedOrderChart,
} from "../cache/order-chart-cache";

const logger = createLogger("order-service:routes");

export const orderRoute = async (fastify: FastifyInstance) => {
  fastify.get(
    "/user-orders",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { result: orders } = await measureAsync(
        "db.order.findUserOrders",
        async () => {
          return await Order.find({ userId: request.userId }).sort({
            createdAt: -1,
          });
        },
      );
      return reply.send(orders);
    },
  );

  fastify.get(
    "/orders/:id",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const order = await Order.findById(id);
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      // Prevent IDOR: Ensure only the owning user or an administrator can access this order
      if (order.userId !== request.userId && request.userRole !== "admin") {
        return reply
          .status(403)
          .send({ message: "Access forbidden: order does not belong to you" });
      }

      return reply.send(order);
    },
  );

  fastify.post(
    "/orders/cod",
    { preHandler: shouldBeUser },
    async (request, reply) => {
      const body = request.body as {
        email: string;
        amount: number;
        carrier?: string;
        serviceType?: string;
        shippingRateAmount?: number;
        codFee?: number;
        shippingAddress: {
          fullName: string;
          phone: string;
          addressLine1: string;
          addressLine2?: string | null;
          city: string;
          state?: string | null;
          postalCode: string;
          country: string;
        };
        products: {
          name: string;
          quantity: number;
          price: number;
        }[];
      };

      if (!body.email || !body.amount || !body.shippingAddress) {
        return reply
          .status(400)
          .send({ message: "Missing required order fields" });
      }

      const newOrder = new Order({
        userId: request.userId,
        email: body.email,
        amount: body.amount,
        status: "success",
        paymentMethod: "cod",
        isCod: true,
        carrier: body.carrier || "custom",
        shippingAddress: body.shippingAddress,
        products: body.products ?? [],
      });

      const saved = await newOrder.save();
      logger.info(`COD Order created with ID: ${saved._id}`);

      // Dispatch order.created with COD and carrier attributes
      const { producer } = await import("../utils/kafka.js");
      await producer.send("order.created", {
        value: {
          orderId: saved._id.toString(),
          userId: saved.userId,
          email: saved.email,
          amount: saved.amount,
          status: saved.status,
          paymentMethod: "cod",
          isCod: true,
          codAmount: saved.amount,
          codFee: body.codFee ?? 0,
          carrier: body.carrier || "custom",
          serviceType: body.serviceType || "standard",
          shippingRateAmount: body.shippingRateAmount ?? 0,
          shippingAddress: body.shippingAddress,
          products: saved.products,
        },
      });

      return reply.status(201).send(saved);
    },
  );

  fastify.get(
    "/orders",
    { preHandler: shouldBeAdmin },
    async (request, reply) => {
      const { limit } = request.query as { limit: number };
      const { result: orders } = await measureAsync(
        "db.order.findAdminOrders",
        async () => {
          return await Order.find().limit(limit).sort({ createdAt: -1 });
        },
      );
      return reply.send(orders);
    },
  );

  fastify.get(
    "/order-chart",
    { preHandler: shouldBeAdmin },
    async (request, reply) => {
      // Serve the chart from Redis when it is warm; the aggregation below is the
      // expensive path this cache exists to skip.
      const cached = await getCachedOrderChart();
      if (cached) return reply.send(cached);

      const now = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));

      const { result: raw } = await measureAsync(
        "db.order.aggregateChart",
        async () => {
          return await Order.aggregate([
            {
              $match: {
                createdAt: { $gte: sixMonthsAgo, $lte: now },
              },
            },
            {
              $group: {
                _id: {
                  year: { $year: "$createdAt" },
                  month: { $month: "$createdAt" },
                },
                total: { $sum: 1 },
                successful: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "success"] }, 1, 0],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                year: "$_id.year",
                month: "$_id.month",
                total: 1,
                successful: 1,
              },
            },
            {
              $sort: { year: 1, month: 1 },
            },
          ]);
        },
      );

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      const results: OrderChartType[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        const match = raw.find(
          (item: any) => item.year === year && item.month === month,
        );

        results.push({
          month: monthNames[month - 1] as string,
          total: match ? match.total : 0,
          successful: match ? match.successful : 0,
        });
      }

      await setCachedOrderChart(results);

      logger.debug("Order chart generated successfully");
      return reply.send(results);
    },
  );
};
