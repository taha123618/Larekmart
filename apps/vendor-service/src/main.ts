import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module.js";
import { env } from "./config/env.js";

async function bootstrap() {
  const logger = new Logger("VendorServiceBootstrap");
  const adapter = new FastifyAdapter();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-user-id",
      "x-user-role",
      "x-user-email",
      "x-internal-secret",
    ],
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, env.HOST);
  logger.log(`vendor-service listening on http://${env.HOST}:${env.PORT}`);
}

bootstrap().catch((err) => {
  console.error("Fatal error during vendor-service bootstrap:", err);
  process.exit(1);
});
