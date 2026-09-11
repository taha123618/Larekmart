import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { createConsumer, createKafkaClient } from "@repo/kafka";
import { initAnalyticsDB } from "./db.js";
import analyticsRouter from "./routes/analytics.route.js";
import {
  recordPayment,
  recordOrder,
  recordUserSignup,
  recordProductCreated,
  recordProductDeleted,
  getMetricsSnapshot,
} from "./services/metrics.service.js";
import type {
  PaymentSuccessfulType,
  OrderCreatedType,
  UserCreatedType,
  StripeProductType,
} from "@repo/types";

const app = express();
const PORT = process.env.PORT || 8004;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3002", "http://localhost:3003"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(clerkMiddleware());

// Health check
app.get("/health", (req: Request, res: Response) => {
  return res.status(200).json({
    status: "ok",
    service: "analytic-service",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Mount analytics routes
app.use("/analytics", analyticsRouter);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[Analytic Service HTTP Error]:", err);
  return res
    .status(err.status || 500)
    .json({ message: err.message || "Internal Server Error" });
});

// Kafka client & consumer setup
const kafka = createKafkaClient("analytic-service");
const consumer = createConsumer(kafka, "analytic-service-group");

const start = async () => {
  try {
    console.log("Starting Analytic Service...");

    // 1. Initialize DB tables if PostgreSQL is available
    await initAnalyticsDB();

    // 2. Connect Kafka consumer
    await consumer.connect();

    // 3. Register subscriptions for all project event streams
    await consumer.subscribe([
      {
        topicName: "payment.successful",
        topicHandler: async (message: any) => {
          const payload: PaymentSuccessfulType = message.value || message;
          if (payload) {
            await recordPayment(payload);
          }
        },
      },
      {
        topicName: "payment-successful",
        topicHandler: async (message: any) => {
          const payload: PaymentSuccessfulType = message.value || message;
          if (payload) {
            await recordPayment(payload);
          }
        },
      },
      {
        topicName: "order.created",
        topicHandler: async (message: any) => {
          const payload: OrderCreatedType = message.value || message;
          if (payload) {
            await recordOrder(payload);
          }
        },
      },
      {
        topicName: "order-successful",
        topicHandler: async (message: any) => {
          const payload: OrderCreatedType = message.value || message;
          if (payload) {
            await recordOrder(payload);
          }
        },
      },
      {
        topicName: "user.created",
        topicHandler: async (message: any) => {
          const payload: UserCreatedType = message.value || message;
          if (payload) {
            await recordUserSignup(payload);
          }
        },
      },
      {
        topicName: "email-successful",
        topicHandler: async (message: any) => {
          const payload: UserCreatedType = message.value || message;
          if (payload) {
            await recordUserSignup(payload);
          }
        },
      },
      {
        topicName: "product.created",
        topicHandler: async (message: any) => {
          const payload: StripeProductType = message.value || message;
          if (payload) {
            await recordProductCreated(payload);
          }
        },
      },
      {
        topicName: "product.deleted",
        topicHandler: async (message: any) => {
          const payload = message.value !== undefined ? message.value : message;
          if (payload !== undefined) {
            await recordProductDeleted(payload);
          }
        },
      },
    ]);

    // 4. Start HTTP Server
    app.listen(PORT, () => {
      console.log(`Analytic Service HTTP API is running on port ${PORT}`);
    });

    console.log(
      "Analytic Service is running and actively listening to Kafka event streams.",
    );

    // Periodic heartbeat log of accumulated metrics
    setInterval(() => {
      const snapshot = getMetricsSnapshot();
      console.log(
        `[Analytics Heartbeat] Revenue: $${snapshot.totalRevenue.toFixed(2)} | Orders: ${snapshot.totalOrders} | Signups: ${snapshot.totalSignups} | Products: +${snapshot.totalProductsCreated}/-${snapshot.totalProductsDeleted}`,
      );
    }, 60000);
  } catch (error) {
    console.error(
      "Analytic Service encountered a critical startup error:",
      error,
    );
  }
};

start();
