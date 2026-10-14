import { producer } from "../../utils/kafka.js";
import { v4 as uuidv4 } from "uuid";
import type {
  WishlistCreatedEvent,
  WishlistItemAddedEvent,
  WishlistItemRemovedEvent,
  WishlistItemMovedEvent,
  WishlistMergedEvent,
  WishlistPriceDropAlertEvent,
  WishlistRestockedAlertEvent,
} from "@repo/types";
import { logger } from "../../observability/metrics.js";

export async function initProducer(): Promise<void> {
  try {
    await producer.connect();
    logger.info("Kafka producer connected in wishlist-service");
  } catch (err) {
    logger.warn("Kafka producer connection warning:", { err });
  }
}

async function sendEvent<T extends object>(
  topic: string,
  eventName: string,
  data: T,
) {
  const payload = {
    eventId: `evt_${uuidv4()}`,
    eventType: eventName,
    timestamp: new Date().toISOString(),
    data,
    ...data,
  };

  try {
    await producer.send(topic, { value: payload });
    logger.info(`[Kafka] Published ${eventName} to topic ${topic}`);
  } catch (error) {
    logger.error(`[Kafka] Failed to publish ${eventName}:`, { error });
  }
}

export async function publishWishlistCreated(data: WishlistCreatedEvent) {
  await sendEvent("wishlist.created", "wishlist.created", data);
}

export async function publishWishlistItemAdded(data: WishlistItemAddedEvent) {
  await sendEvent("wishlist.item.added", "wishlist.item.added", data);
}

export async function publishWishlistItemRemoved(
  data: WishlistItemRemovedEvent,
) {
  await sendEvent("wishlist.item.removed", "wishlist.item.removed", data);
}

export async function publishWishlistItemMoved(data: WishlistItemMovedEvent) {
  await sendEvent("wishlist.item.moved", "wishlist.item.moved", data);
}

export async function publishWishlistMerged(data: WishlistMergedEvent) {
  await sendEvent("wishlist.merged", "wishlist.merged", data);
}

export async function publishPriceDropAlert(data: WishlistPriceDropAlertEvent) {
  await sendEvent("wishlist.price-drop", "wishlist.price-drop", data);
}

export async function publishRestockedAlert(data: WishlistRestockedAlertEvent) {
  await sendEvent("wishlist.restocked", "wishlist.restocked", data);
}
