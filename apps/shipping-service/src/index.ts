import { createServer } from "./server.js";
import { env } from "./config/env.js";
import { ProviderRegistry } from "./providers/registry.js";
import { ShipmentRepository } from "./repositories/shipment.repository.js";
import { startOrderConsumer } from "./consumers/order.consumer.js";
import { startPaymentConsumer } from "./consumers/payment.consumer.js";
import { disconnectPrisma } from "@repo/shipping-db";
import { producer, consumer } from "./utils/kafka.js";

async function main() {
  console.log(
    `[ShippingService] Initializing shipping-service on port ${env.PORT}...`,
  );

  // 1. Initialize Carrier Provider Registry
  ProviderRegistry.initialize();
  console.log(
    "[ShippingService] Carrier provider registry initialized (TCS, Leopards, DHL, FedEx, Custom)",
  );

  // 2. Seed Default Shipping Methods in PostgreSQL
  try {
    await ShipmentRepository.seedDefaultMethodsIfEmpty();
    console.log(
      "[ShippingService] Shipping methods validated/seeded in PostgreSQL",
    );
  } catch (err) {
    console.warn(
      "[ShippingService] Failed to seed default shipping methods:",
      err,
    );
  }

  // 3. Connect Kafka Producer & Consumers
  try {
    await producer.connect();
    console.log("[ShippingService] Kafka producer connected");
    await startOrderConsumer();
    await startPaymentConsumer();
    console.log(
      "[ShippingService] Kafka consumers started for order and payment events",
    );
  } catch (err) {
    console.warn(
      "[ShippingService] Kafka integration unavailable; running in HTTP-only resilient mode:",
      err instanceof Error ? err.message : err,
    );
  }

  // 4. Start HTTP Server
  const app = createServer();
  const server = app.listen(env.PORT, () => {
    console.log(
      `[ShippingService] HTTP Server listening on http://localhost:${env.PORT}`,
    );
    console.log(
      `[ShippingService] Health check: http://localhost:${env.PORT}/api/v1/health`,
    );
    console.log(
      `[ShippingService] Rates: http://localhost:${env.PORT}/api/v1/shipping/rates?city=Karachi&weight=1.5`,
    );
  });

  // 5. Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(
      `[ShippingService] Received ${signal}, starting graceful shutdown...`,
    );
    server.close(async () => {
      try {
        await disconnectPrisma();
        await producer.disconnect();
        await consumer.disconnect();
        console.log("[ShippingService] Resources released. Exiting clean.");
        process.exit(0);
      } catch (err) {
        console.error("[ShippingService] Error during shutdown:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[ShippingService] Fatal error during startup:", err);
  process.exit(1);
});
