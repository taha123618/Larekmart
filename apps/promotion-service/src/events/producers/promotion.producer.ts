import { producer } from "../../utils/kafka.js";
import { v4 as uuidv4 } from "uuid";
import type {
  PromotionCreatedEvent,
  PromotionActivatedEvent,
  PromotionDeactivatedEvent,
  PromotionReservedEvent,
  PromotionRedeemedEvent,
  PromotionReservationReleasedEvent,
  PromotionBudgetExhaustedEvent,
} from "@repo/types";
import { logger } from "../../observability/metrics.js";

export async function initProducer(): Promise<void> {
  try {
    await producer.connect();
    logger.info("Kafka producer connected in promotion-service");
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

export async function publishPromotionCreated(data: PromotionCreatedEvent) {
  await sendEvent("promotion.created", "promotion.created", data);
}

export async function publishPromotionActivated(data: PromotionActivatedEvent) {
  await sendEvent("promotion.activated", "promotion.activated", data);
}

export async function publishPromotionDeactivated(data: PromotionDeactivatedEvent) {
  await sendEvent("promotion.deactivated", "promotion.deactivated", data);
}

export async function publishPromotionReserved(data: PromotionReservedEvent) {
  await sendEvent("promotion.reserved", "promotion.reserved", data);
}

export async function publishPromotionRedeemed(data: PromotionRedeemedEvent) {
  await sendEvent("promotion.redeemed", "promotion.redeemed", data);
}

export async function publishPromotionReservationReleased(
  data: PromotionReservationReleasedEvent,
) {
  await sendEvent(
    "promotion.reservation.released",
    "promotion.reservation.released",
    data,
  );
}

export async function publishPromotionBudgetExhausted(
  data: PromotionBudgetExhaustedEvent,
) {
  await sendEvent(
    "promotion.budget.exhausted",
    "promotion.budget.exhausted",
    data,
  );
}
