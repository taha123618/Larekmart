import type { FastifyPluginAsync } from "fastify";
import { checkDatabaseConnection } from "../db/connection.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  const handler = async (_req: unknown, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
    const dbStatus = await checkDatabaseConnection();
    if (!dbStatus.healthy) {
      reply.status(503).send({
        status: "degraded",
        service: "seller-service",
        database: dbStatus,
      });
      return;
    }
    reply.status(200).send({
      status: "ok",
      service: "seller-service",
      database: "connected",
    });
  };

  app.get("/health", handler);
  app.get("/ready", handler);
  app.get("/api/v1/sellers/health", handler);

  app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", "text/plain").send("# HELP seller_service_up Status\n# TYPE seller_service_up gauge\nseller_service_up 1\n");
  });
};
