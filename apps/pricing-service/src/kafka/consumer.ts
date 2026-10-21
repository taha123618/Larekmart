import { consumer } from "../utils/kafka.js";
import { pricingEventProducer } from "./producer.js";
import { db } from "../db/connection.js";
import { productPrices, priceLists, priceQuotes } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

interface ProductCreatedPayload {
  id?: string | number;
  productId?: string | number;
  price?: number;
  currency?: string;
  name?: string;
}

interface ProductDeletedPayload {
  productId?: string | number;
  id?: string | number;
}

interface OrderCreatedPayload {
  orderId?: string;
  userId?: string | null;
  amount?: number;
  currency?: string;
  products?: unknown;
  items?: unknown;
}

export async function handleProductCreatedEvent(message: {
  value: ProductCreatedPayload;
}): Promise<void> {
  const payload = message.value;
  const productId = String(payload?.productId || payload?.id || "");
  const price = payload?.price;

  if (!productId || typeof price !== "number" || isNaN(price) || price < 0) {
    return;
  }

  try {
    // 1. Get default B2C price list
    const defaultList = await db.query.priceLists.findFirst({
      where: eq(priceLists.code, "DEFAULT_B2C"),
    });

    if (!defaultList) return;

    // 2. Check if product price already exists
    const existing = await db.query.productPrices.findFirst({
      where: and(
        eq(productPrices.priceListId, defaultList.id),
        eq(productPrices.productId, productId),
      ),
    });

    if (!existing) {
      const [created] = await db
        .insert(productPrices)
        .values({
          priceListId: defaultList.id,
          productId,
          basePrice: String(price),
          currency: payload.currency || "USD",
          isActive: true,
        })
        .returning();

      if (created) {
        console.log(
          `[PricingConsumer] Seeded base price for new product [${productId}]: $${price}`,
        );

        // Publish pricing.price.created event
        await pricingEventProducer.publishPriceCreated({
          priceId: created.id,
          priceListId: defaultList.id,
          productId,
          basePrice: price,
          currency: payload.currency || "USD",
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error(
      "[PricingConsumer] Error handling product.created event:",
      err,
    );
  }
}

export async function handleProductDeletedEvent(message: {
  value: ProductDeletedPayload;
}): Promise<void> {
  const payload = message.value;
  const productId = String(payload?.productId || payload?.id || "");
  if (!productId) return;

  try {
    await db
      .update(productPrices)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(productPrices.productId, productId));

    console.log(
      `[PricingConsumer] Deactivated prices for deleted product: ${productId}`,
    );
  } catch (err) {
    console.error(
      `[PricingConsumer] Error handling product.deleted event:`,
      err,
    );
  }
}

export async function handleOrderCreatedEvent(message: {
  value: OrderCreatedPayload;
}): Promise<void> {
  const payload = message.value;
  const orderId = payload?.orderId;
  const amount = payload?.amount ?? 0;

  if (!orderId) return;

  try {
    const quoteId = `order_snap_${orderId}`;
    const rawItems = payload.items || payload.products || [];
    const itemsJson = Array.isArray(rawItems) ? rawItems : [];

    // Idempotent insertion of order pricing snapshot
    await db
      .insert(priceQuotes)
      .values({
        quoteId,
        currency: payload.currency || "USD",
        items: itemsJson,
        subtotal: String(amount),
        totalDiscount: "0.0000",
        promotionDiscount: "0.0000",
        finalTotal: String(amount),
        customerGroup: payload.userId ? "registered_user" : "guest",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year immutable retention
      })
      .onConflictDoNothing();

    console.log(
      `[PricingConsumer] Persisted immutable pricing snapshot for order [${orderId}]`,
    );
  } catch (err) {
    console.error(
      `[PricingConsumer] Error handling order.created snapshot event:`,
      err,
    );
  }
}

export async function startKafkaConsumers(): Promise<void> {
  try {
    await pricingEventProducer.connect();
    await consumer.connect();

    await consumer.subscribe([
      {
        topicName: "product.created",
        topicHandler: handleProductCreatedEvent,
      },
      {
        topicName: "product.deleted",
        topicHandler: handleProductDeletedEvent,
      },
      {
        topicName: "order.created",
        topicHandler: handleOrderCreatedEvent,
      },
    ]);

    console.log(
      "[Kafka] Pricing service consumers connected and running (product.created, product.deleted, order.created)",
    );
  } catch (err) {
    console.warn(
      "[Kafka] Warning: Kafka connection deferred or failed in pricing-service:",
      err,
    );
  }
}
