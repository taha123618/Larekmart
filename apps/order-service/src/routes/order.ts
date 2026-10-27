import { FastifyInstance } from "fastify";
import {
  shouldBeAdmin,
  shouldBeSeller,
  shouldBeUser,
} from "../middleware/authMiddleware";
import { Order, mongoose } from "@repo/order-db";
import { startOfMonth, subMonths } from "date-fns";
import {
  OrderChartType,
  CreateCodOrderSchema,
  type CreateCodOrderInput,
} from "@repo/types";
import { createLogger, measureAsync } from "@repo/monitoring";
import {
  getCachedOrderChart,
  setCachedOrderChart,
} from "../cache/order-chart-cache";
import { dispatchViaOutbox } from "../outbox/outbox-relay.js";
import { executeWithIdempotency } from "../middleware/idempotency.js";

/**
 * Resolves server-authoritative unit prices (in paisa) for COD line items.
 *
 * The client-declared per-product price is ignored; the product database is
 * the only price authority. Throws when any productId is unknown to the
 * catalog so a manipulated payload cannot create a mispriced order.
 */
const getServerProductPricesPaisa = async (
  productIds: number[],
): Promise<Map<number, number>> => {
  const uniqueIds = Array.from(new Set(productIds));

  const { PrismaClient } = await import("@repo/product-db");
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, price: true },
    });

    const prices = new Map<number, number>();
    for (const product of products) {
      prices.set(product.id, product.price * 100);
    }
    return prices;
  } finally {
    await prisma.$disconnect();
  }
};

/**
 * Recomputes the authoritative COD total (paisa) from server prices and the
 * declared order components: items + shipping + COD fee - discount + tax.
 */
export const computeCodOrderTotalPaisa = (
  body: CreateCodOrderInput,
  serverPrices: Map<number, number>,
): number => {
  const itemsTotal = body.products.reduce(
    (sum, product) =>
      sum + (serverPrices.get(product.productId) ?? 0) * product.quantity,
    0,
  );
  return Math.max(
    0,
    itemsTotal +
      (body.shippingRateAmount ?? 0) +
      (body.codFee ?? 0) -
      body.discountTotal +
      body.taxTotal,
  );
};

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
    "/seller-orders",
    { preHandler: shouldBeSeller },
    async (request, reply) => {
      const { sellerId, limit } = request.query as {
        sellerId?: string;
        limit?: number;
      };

      // SEC-01 IDOR & Data Exposure Remediation:
      // Scope query strictly to the authenticated seller identity unless caller is an admin.
      const isAdmin = request.userRole === "admin";
      if (!isAdmin && sellerId && sellerId !== request.userId) {
        return reply.status(403).send({
          message: "Access forbidden: you cannot query orders of other sellers",
        });
      }

      const effectiveSellerId = isAdmin ? sellerId : request.userId;
      if (!isAdmin && !effectiveSellerId) {
        return reply.status(400).send({
          message: "Seller identity required to access seller orders",
        });
      }

      const query: Record<string, unknown> = {};
      if (effectiveSellerId) {
        query.$or = [
          { sellerId: effectiveSellerId },
          { "products.sellerId": effectiveSellerId },
        ];
      }

      const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

      const { result: orders } = await measureAsync(
        "db.order.findSellerOrders",
        async () => {
          return await Order.find(query)
            .limit(safeLimit)
            .sort({ createdAt: -1 });
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
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return reply.status(400).send({ message: "Invalid order ID format" });
      }
      const order = await Order.findById(id);
      if (!order) {
        return reply.status(404).send({ message: "Order not found" });
      }

      // Prevent IDOR: Ensure only the owning user, assigned seller, or an administrator can access this order
      const isOwner = order.userId === request.userId;
      const isAdmin = request.userRole === "admin";
      const isAssignedSeller =
        request.userRole === "seller" &&
        (order.sellerId === request.userId ||
          order.products.some((p: any) => p.sellerId === request.userId));

      if (!isOwner && !isAdmin && !isAssignedSeller) {
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
      const parsed = CreateCodOrderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          message: "Invalid order payload",
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const body = parsed.data;

      return executeWithIdempotency(
        request,
        reply,
        async () => {
          // Price integrity: every line item is priced from the product database
          // and the total is recomputed server-side. The client-declared amount is
          // a cross-check only — a mismatch is rejected with 409, and an unknown
          // productId fails before any order is written.
          let serverPrices: Map<number, number>;
          try {
            serverPrices = await getServerProductPricesPaisa(
              body.products.map((product) => product.productId),
            );
          } catch {
            const err = new Error(
              "Unable to verify product prices, please retry shortly",
            );
            (err as any).statusCode = 502;
            throw err;
          }

          const missingProduct = body.products.find(
            (product) => !serverPrices.has(product.productId),
          );
          if (missingProduct) {
            const err = new Error("Order contains an unknown product");
            (err as any).statusCode = 409;
            throw err;
          }

          const serverAmount = computeCodOrderTotalPaisa(body, serverPrices);
          if (serverAmount !== body.amount) {
            const err = new Error(
              "Declared amount does not match server-computed total",
            );
            (err as any).statusCode = 409;
            throw err;
          }

          const newOrder = new Order({
            userId: request.userId,
            email: body.email,
            amount: serverAmount,
            taxAmount: body.taxTotal ?? 0,
            taxCalculationId: body.taxCalculationId || null,
            status: "success",
            paymentMethod: "cod",
            isCod: true,
            carrier: body.carrier || "custom",
            shippingAddress: body.shippingAddress,
            products: body.products.map((product) => ({
              name: String(product.productId),
              quantity: product.quantity,
              price: serverPrices.get(product.productId) ?? 0,
            })),
          });

          const saved = await newOrder.save();
          logger.info(`COD Order created with ID: ${saved._id}`);

          // Dispatch order.created via Transactional Outbox
          await dispatchViaOutbox("order.created", {
            orderId: saved._id.toString(),
            userId: saved.userId,
            reservationId: body.reservationId || null,
            couponCode: body.couponCode || null,
            taxCalculationId: body.taxCalculationId || null,
            taxAmount: body.taxTotal ?? 0,
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
          });

          return { statusCode: 201, data: saved };
        },
        { prefix: "order:cod:" },
      );
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
