import { SchemaRegistryClient } from "./schema-registry/client.js";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("schema-init");

/**
 * Standard JSON Schema definitions for core Larekmart event contracts.
 * Registered with Karapace / Confluent Schema Registry under `<topic>-value`.
 */
export const CORE_EVENT_SCHEMAS: Record<string, object> = {
  // 1. Order Created
  "order.created-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "OrderCreatedPayload",
    type: "object",
    properties: {
      orderId: { type: "string" },
      userId: { type: "string" },
      email: { type: "string" },
      totalAmount: { type: "number" },
      currency: { type: "string", default: "PKR" },
      status: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            productId: { type: "integer" },
            variantId: { type: "string" },
            quantity: { type: "integer" },
            price: { type: "number" },
          },
          required: ["productId", "quantity", "price"],
        },
      },
      createdAt: { type: "string" },
    },
    required: ["orderId", "email", "totalAmount"],
  },

  // 2. Payment Successful
  "payment.successful-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "PaymentSuccessfulPayload",
    type: "object",
    properties: {
      orderId: { type: "string" },
      paymentIntentId: { type: "string" },
      amount: { type: "number" },
      currency: { type: "string", default: "PKR" },
      userId: { type: "string" },
      customerEmail: { type: "string" },
      paymentMethod: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["orderId", "amount"],
  },

  // 3. Inventory Stock Sold (Debezium CDC)
  "inventory.stock.sold-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "InventoryStockSoldPayload",
    type: "object",
    properties: {
      inventoryItemId: { type: "string" },
      productId: { type: "integer" },
      variantId: { type: "string" },
      warehouseId: { type: "string" },
      quantity: { type: "integer" },
      availableQuantity: { type: "integer" },
      reservedQuantity: { type: "integer" },
      soldQuantity: { type: "integer" },
      status: { type: "string" },
      reservationId: { type: "string" },
      referenceType: { type: "string" },
      referenceId: { type: "string" },
      occurredAt: { type: "string" },
    },
    required: ["productId", "warehouseId", "quantity"],
  },

  // 4. Payout Scheduled (Debezium CDC)
  "payout.scheduled-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "PayoutScheduledPayload",
    type: "object",
    properties: {
      payoutId: { type: "string" },
      payoutNumber: { type: "string" },
      sellerId: { type: "string" },
      batchId: { type: "string" },
      amount: { type: "number" },
      netAmount: { type: "number" },
      currency: { type: "string", default: "PKR" },
      idempotencyKey: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["payoutId", "sellerId", "amount"],
  },

  // 5. Payout Completed (Debezium CDC)
  "payout.completed-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "PayoutCompletedPayload",
    type: "object",
    properties: {
      payoutId: { type: "string" },
      payoutNumber: { type: "string" },
      sellerId: { type: "string" },
      providerReference: { type: "string" },
      amount: { type: "number" },
      currency: { type: "string", default: "PKR" },
      settledAt: { type: "string" },
      timestamp: { type: "string" },
    },
    required: ["payoutId", "sellerId"],
  },

  // 6. Commission Calculated
  "commission.calculated-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "CommissionCalculatedPayload",
    type: "object",
    properties: {
      calculationId: { type: "string" },
      orderId: { type: "string" },
      sellerId: { type: "string" },
      totalCommission: { type: "number" },
      netVendorPayout: { type: "number" },
      currency: { type: "string", default: "PKR" },
      timestamp: { type: "string" },
    },
    required: ["calculationId", "orderId", "sellerId", "totalCommission"],
  },

  // 7. Notification Dispatch
  "notification.dispatch-value": {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: "NotificationDispatchPayload",
    type: "object",
    properties: {
      type: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      userId: { type: "string" },
      metadata: { type: "object" },
      timestamp: { type: "string" },
    },
    required: ["type", "title"],
  },
};

/**
 * Initializes and registers all core event schemas with Schema Registry.
 */
export async function initializeSchemas(
  client?: SchemaRegistryClient,
): Promise<{ registered: number; failed: number }> {
  const registry = client || new SchemaRegistryClient();
  let registered = 0;
  let failed = 0;

  logger.info("Initializing Larekmart Kafka schemas in Schema Registry...");

  for (const [subject, schemaObj] of Object.entries(CORE_EVENT_SCHEMAS)) {
    try {
      const res = await registry.registerSchema(subject, {
        schema: schemaObj,
        schemaType: "JSON",
      });
      logger.info(`Registered schema for subject [${subject}] (ID: ${res.id}, version: ${res.version})`);
      registered++;
    } catch (err) {
      logger.warn(`Could not register schema for [${subject}]: ${err}`);
      failed++;
    }
  }

  logger.info(`Schema initialization complete: ${registered} registered, ${failed} failed`);
  return { registered, failed };
}

if (process.argv[1]?.endsWith("init-schemas.ts")) {
  initializeSchemas()
    .then((res) => {
      console.log(`Schema Registry initialized: ${res.registered} registered, ${res.failed} failed.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Schema Registry initialization failed:", err);
      process.exit(1);
    });
}
