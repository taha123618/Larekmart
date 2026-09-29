import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { shouldBeAdmin } from "./middleware/authMiddleware.js";
import userRoute from "./routes/user.route.js";
import { producer } from "./utils/kafka.js";
import {
  createLogger,
  createHealthRegistry,
  createMetricsRegistry,
  createHttpMonitor,
  createMemoryCheck,
  captureError,
} from "@repo/monitoring";

const logger = createLogger("auth-service");
const metrics = createMetricsRegistry("auth-service");
const httpMonitor = createHttpMonitor(logger, metrics);
const health = createHealthRegistry("auth-service", "1.0.0");

health.register("memory", createMemoryCheck(512 * 1024 * 1024), {
  critical: false,
});

const app = express();
const allowedOrigins = [process.env.ADMIN_URL || "http://localhost:3003"];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json());
app.use(clerkMiddleware());

// HTTP Request Monitoring Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || req.path === "/metrics") {
    return next();
  }
  const hook = httpMonitor.onRequestStart({
    method: req.method,
    url: req.path,
  });
  res.on("finish", () => {
    hook.onRequestEnd(res.statusCode);
  });
  next();
});

app.get("/health", async (req: Request, res: Response) => {
  const report = await health.runChecks();
  const statusCode = report.status === "unhealthy" ? 503 : 200;
  return res.status(statusCode).json(report);
});

app.get("/metrics", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  return res.send(metrics.toPrometheus());
});

app.use("/users", shouldBeAdmin, userRoute);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const formatted = captureError(err, {
    serviceName: "auth-service",
    logger,
    route: req.url,
  });
  return res
    .status(formatted.statusCode || 500)
    .json({ message: formatted.message || "Internal Server Error!" });
});

const start = async () => {
  try {
    await producer.connect();
    app.listen(8003, () => {
      logger.info("Auth service is running on port 8003");
    });
  } catch (error) {
    logger.fatal("Failed to initialize auth-service", error);
    process.exit(1);
  }
};

start();
