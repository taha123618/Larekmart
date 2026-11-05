import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./config/env.js";
import { registerConversationRoutes } from "./routes/conversation.routes.js";
import { registerMessageRoutes } from "./routes/message.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { initSocketIO } from "./websocket/chat.gateway.js";
import { closeDatabase } from "./db/connection.js";
import { closeRedisClient } from "./middleware/idempotency.middleware.js";
import { connectKafkaProducer, closeKafkaProducer } from "./kafka/producer.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
    trustProxy: true,
  });

  // Enable CORS
  await app.register(cors, {
    origin: [
      env.CLIENT_URL,
      env.ADMIN_URL,
      "http://localhost:3000",
      "http://localhost:3002",
      "http://localhost:3003",
    ],
    credentials: true,
  });

  // Register Routes
  await registerHealthRoutes(app);
  await registerConversationRoutes(app);
  await registerMessageRoutes(app);

  return app;
}

export async function startServer() {
  const app = await buildApp();

  try {
    // Fastify wraps Node http.Server at app.server
    await app.ready();
    initSocketIO(app.server);
    await connectKafkaProducer();

    await app.listen({
      port: env.PORT,
      host: "0.0.0.0",
    });

    console.log(
      `[ChatService] Fastify 5 & Socket.IO HTTP Server listening on port ${env.PORT}`,
    );
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[ChatService] Received ${signal}, closing gracefully...`);
    await app.close();
    await closeDatabase();
    await closeRedisClient();
    await closeKafkaProducer();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  startServer();
}
