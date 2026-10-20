import { createKafkaClient } from "./client";

export const ALL_LAREKMART_TOPICS = [
  // Products & Categories
  "product.created",
  "product.updated",
  "product.deleted",
  "category.created",
  "category.updated",
  "category.deleted",

  // Orders
  "order.created",
  "order.completed",
  "order.cancelled",
  "order-successful",

  // Payments
  "payment.successful",
  "payment-successful",

  // Behavioral & Recommendations
  "product.viewed",
  "product.searched",
  "product.added_to_cart",
  "product.removed_from_cart",
  "wishlist.product_added",
  "recommendation.interaction",
  "review.created",
  "review.updated",
  "review.deleted",
  "review.approved",
  "review.rejected",
  "review.reported",
  "product.rating-summary.updated",

  // Cart Events
  "cart.created",
  "cart.updated",
  "cart.item_added",
  "cart.item_updated",
  "cart.item_removed",
  "cart.merged",
  "cart.coupon_added",
  "cart.coupon_removed",
  "cart.expired",
  "cart.cleared",

  // Wishlist Events
  "wishlist.created",
  "wishlist.updated",
  "wishlist.deleted",
  "wishlist.item.added",
  "wishlist.item.removed",
  "wishlist.merged",
  "wishlist.price-drop.alert",
  "wishlist.restock.alert",

  // Promotion Events
  "promotion.created",
  "promotion.activated",
  "promotion.deactivated",
  "promotion.reserved",
  "promotion.redeemed",
  "promotion.reservation.released",
  "promotion.budget.exhausted",

  // Shipping & Logistics
  "shipment.created",
  "shipment.label_created",
  "shipment.ready_for_pickup",
  "shipment.picked_up",
  "shipment.in_transit",
  "shipment.shipped",
  "shipment.out_for_delivery",
  "shipment.delivered",
  "shipment.delivery_failed",
  "shipment.returned",
  "shipment.cancelled",
  "shipment.failed",
  "tracking.updated",

  // Email & Notifications
  "email.dispatch",
  "email-successful",
  "notification.dispatch",

  // Auth & User Domain
  "user.created",
  "user.updated",
  "user.profile_updated",
  "user.avatar_uploaded",
  "user.address_created",
  "user.address_updated",
  "user.address_deleted",
  "user.preferences_updated",
  "user.deleted",
  "user.deletion_requested",
  "auth.user_created",
  "user.registered",

  // Inventory
  "inventory.created",
  "inventory.reserved",
  "inventory.reservation.confirmed",
  "inventory.stock.sold",
  "inventory.released",
  "inventory.reservation.expired",
  "inventory.restocked",
  "inventory.adjusted",
  "inventory.low_stock",
  "inventory.out_of_stock",

  // Media
  "media.upload_requested",
  "media.uploaded",
  "media.processing_started",
  "media.processing_completed",
  "media.processing_failed",
  "media.deleted",
  "media.quarantined",

  // Tax Events
  "tax.calculation.completed",
  "tax.calculation.failed",
  "tax.rules.updated",
  "tax.calculation.adjusted",

  // Return & Refund Events
  "return.requested",
  "return.approved",
  "return.rejected",
  "return.cancelled",
  "return.shipment.requested",
  "return.inspection.completed",
  "return.refund.requested",
  "return.completed",
  "payment.refund.succeeded",
  "payment.refund.failed",
  "shipping.label.created",
  "order.delivered",
] as const;

export async function initializeTopics(): Promise<void> {
  const kafkaBrokers = (
    process.env.KAFKA_BROKERS || "localhost:9094,localhost:9095,localhost:9096"
  )
    .split(",")
    .map((b) => b.trim());
  const kafka = createKafkaClient("larekmart-topic-initializer", kafkaBrokers);
  const admin = kafka.admin();

  console.log("[KafkaTopicInit] Connecting to Kafka cluster...");
  await admin.connect();
  console.log("[KafkaTopicInit] Connected successfully.");

  try {
    const existingTopics = await admin.listTopics();
    const existingSet = new Set(existingTopics);

    const topicsToCreate = ALL_LAREKMART_TOPICS.filter(
      (topic) => !existingSet.has(topic),
    ).map((topic) => ({
      topic,
      numPartitions: 3,
      replicationFactor: 1, // compatible with 1 to 3 broker setups
    }));

    if (topicsToCreate.length === 0) {
      console.log(
        `[KafkaTopicInit] All ${ALL_LAREKMART_TOPICS.length} topics already exist in cluster.`,
      );
      return;
    }

    console.log(
      `[KafkaTopicInit] Creating ${topicsToCreate.length} missing topics...`,
    );
    await admin.createTopics({
      topics: topicsToCreate,
      waitForLeaders: true,
    });
    console.log(
      `[KafkaTopicInit] Successfully created ${topicsToCreate.length} topics with 3 partitions!`,
    );
  } finally {
    await admin.disconnect();
    console.log("[KafkaTopicInit] Admin connection closed.");
  }
}

// Auto-run if executed as script
if (process.argv[1] && process.argv[1].endsWith("init-topics.ts")) {
  initializeTopics()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[KafkaTopicInit] Failed to initialize topics:", err);
      process.exit(1);
    });
}
