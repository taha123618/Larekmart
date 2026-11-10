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
  "order.confirmed",
  "order.completed",
  "order.cancelled",
  "order.updated",
  "order-successful",

  // Payments
  "payment.successful",
  "payment.failed",
  "payment-successful",
  "payment.refund.requested",
  "payment.refund.completed",

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
  "wishlist.item_added",
  "wishlist.item.removed",
  "wishlist.item_removed",
  "wishlist.item.moved",
  "wishlist.cleared",
  "wishlist.merged",
  "wishlist.price-drop",
  "wishlist.price-drop.alert",
  "wishlist.restocked",
  "wishlist.restock.alert",

  // Promotion Events
  "promotion.created",
  "promotion.activated",
  "promotion.deactivated",
  "promotion.reserved",
  "promotion.redeemed",
  "promotion.reservation.released",
  "promotion.budget.exhausted",
  "promotion.campaign_created",
  "promotion.coupon_applied",
  "promotion.discount_applied",

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
  "shipping.tracking.updated",
  "shipping.label.created",

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
  "inventory.reservation.requested",
  "inventory.reservation.confirmed",
  "inventory.reservation.cancelled",
  "inventory.reservation.failed",
  "inventory.stock.sold",
  "inventory.released",
  "inventory.reservation.expired",
  "inventory.restocked",
  "inventory.adjusted",
  "inventory.low_stock",
  "inventory.out_of_stock",
  "inventory.availability.changed",

  // Media
  "media.upload_requested",
  "media.uploaded",
  "media.processing_started",
  "media.processing_completed",
  "media.processing_failed",
  "media.processed",
  "media.deleted",
  "media.quarantined",

  // Tax Events
  "tax.calculated",
  "tax.calculation.completed",
  "tax.calculation.failed",
  "tax.calculation.adjusted",
  "tax.calculation.voided",
  "tax.exempted",
  "tax.rules.updated",

  // Return & Refund Events
  "return.created",
  "return.requested",
  "return.approved",
  "return.rejected",
  "return.cancelled",
  "return.shipment.requested",
  "return.inspected",
  "return.inspection.completed",
  "return.refund.requested",
  "return.completed",
  "payment.refund.succeeded",
  "payment.refund.failed",
  "order.delivered",

  // Pricing Events
  "price.updated",
  "product.tax-category.updated",
  "pricing.price.created",
  "pricing.price.updated",
  "pricing.price.expired",
  "pricing.quote.created",

  // Vendor Events
  "vendor.registered",
  "vendor.verification.requested",
  "vendor.verified",
  "vendor.rejected",
  "vendor.suspended",
  "vendor.reactivated",

  // Seller Events
  "seller.created",
  "seller.activated",
  "seller.updated",
  "seller.suspended",
  "seller.storefront.updated",

  // Support Tickets & SLA Lifecycle
  "support.ticket.created",
  "support.ticket.assigned",
  "support.ticket.updated",
  "support.ticket.resolved",

  // Real-Time Chat & Messaging Lifecycle
  "chat.conversation.created",
  "chat.message.created",
  "chat.message.reported",

  // Fraud Assessment & Risk Lifecycle
  "fraud.assessment.completed",
  "fraud.risk.detected",
  "fraud.case.created",
  "fraud.case.resolved",
  "fraud.case.escalated",

  // Commission Engine Lifecycle
  "commission.calculated",
  "commission.accrued",
  "commission.adjusted",
  "commission.reversed",

  // Payout Ledger Lifecycle
  "payout.scheduled",
  "payout.processing",
  "payout.completed",
  "payout.failed",
  "payout.reconciled",

  // Vendor Escrow & Disbursements
  "vendor.escrow.credited",
  "vendor.escrow.released",
  "vendor.payout.requested",
  "vendor.payout.completed",

  // Dispute & Chargeback Lifecycle
  "dispute.created",
  "dispute.rebuttal_submitted",
  "dispute.resolved",
  "payment.dispute.created",
  "payment.dispute.closed",

  // Storefront & Operational Settings
  "marketplace.settings.updated",
  "admin.delegation.granted",
  "admin.delegation.revoked",
] as const;

/**
 * Topic Tiering configuration for 50,000+ RPS Flash-Sale Concurrency.
 * Defines partition allocations to enable horizontal consumer pod scaling.
 */
const TIER_1_TOPICS = new Set<string>([
  "order.created",
  "order.confirmed",
  "order.completed",
  "order.cancelled",
  "order-successful",
  "payment.successful",
  "payment.failed",
  "payment-successful",
  "payment.refund.requested",
  "payment.refund.completed",
  "inventory.reservation.requested",
  "inventory.stock.sold",
  "inventory.reserved",
  "inventory.restocked",
  "inventory.availability.changed",
]);

const TIER_2_TOPICS = new Set<string>([
  "product.viewed",
  "product.searched",
  "product.added_to_cart",
  "product.removed_from_cart",
  "wishlist.product_added",
  "recommendation.interaction",
]);

const TIER_3_TOPICS = new Set<string>([
  "product.created",
  "product.updated",
  "product.deleted",
  "pricing.price.updated",
  "pricing.quote.generated",
  "cart.created",
  "cart.updated",
  "cart.item_added",
  "cart.item_updated",
  "cart.item_removed",
  "cart.merged",
  "wishlist.created",
  "wishlist.updated",
  "review.created",
]);

export function getTopicPartitionCount(topic: string): number {
  const tier1Partitions = Number(process.env.KAFKA_TIER1_PARTITIONS) || 16;
  const tier2Partitions = Number(process.env.KAFKA_TIER2_PARTITIONS) || 16;
  const tier3Partitions = Number(process.env.KAFKA_TIER3_PARTITIONS) || 8;
  const defaultPartitions = Number(process.env.KAFKA_DEFAULT_PARTITIONS) || 4;

  if (TIER_1_TOPICS.has(topic)) return tier1Partitions;
  if (TIER_2_TOPICS.has(topic)) return tier2Partitions;
  if (TIER_3_TOPICS.has(topic)) return tier3Partitions;
  return defaultPartitions;
}

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
    const existingNormalized = new Set(
      existingTopics.map((t) => t.replace(/\./g, "_")),
    );

    const topicsToCreate = ALL_LAREKMART_TOPICS.filter((topic) => {
      if (existingSet.has(topic)) return false;
      const normalized = topic.replace(/\./g, "_");
      if (existingNormalized.has(normalized)) {
        return false;
      }
      return true;
    }).map((topic) => ({
      topic,
      numPartitions: getTopicPartitionCount(topic),
      replicationFactor: 1, // compatible with 1 to 3 broker setups
    }));

    if (topicsToCreate.length === 0) {
      console.log(
        `[KafkaTopicInit] All ${ALL_LAREKMART_TOPICS.length} topics already exist in cluster.`,
      );
      return;
    }

    console.log(
      `[KafkaTopicInit] Creating ${topicsToCreate.length} missing topics with tiered partitioning in batch...`,
    );

    try {
      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
        timeout: 30_000,
      });
      console.log(
        `[KafkaTopicInit] Successfully created all ${topicsToCreate.length} missing topics!`,
      );
    } catch (batchErr: any) {
      console.warn(
        `[KafkaTopicInit] Batch creation encountered an issue (${batchErr?.message || batchErr}); falling back to individual topic creation...`,
      );
      let createdCount = 0;
      for (const item of topicsToCreate) {
        try {
          await admin.createTopics({
            topics: [item],
            waitForLeaders: true,
          });
          createdCount++;
        } catch (topicErr: any) {
          console.warn(
            `[KafkaTopicInit] Warning: Could not create topic "${item.topic}": ${topicErr?.message || topicErr}`,
          );
        }
      }
      console.log(
        `[KafkaTopicInit] Created ${createdCount} of ${topicsToCreate.length} topics via fallback.`,
      );
    }
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
