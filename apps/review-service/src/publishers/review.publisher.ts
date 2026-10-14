import { producer } from "../utils/kafka.js";
import { v4 as uuidv4 } from "uuid";
import type {
  ReviewCreatedEvent,
  ReviewUpdatedEvent,
  ReviewDeletedEvent,
  ReviewApprovedEvent,
  ReviewRejectedEvent,
  ReviewReportedEvent,
  ProductRatingSummaryUpdatedEvent,
} from "@repo/types";

export async function initProducer(): Promise<void> {
  try {
    await producer.connect();
    console.log("Kafka producer connected in review-service");
  } catch (err) {
    console.warn("Kafka producer connection warning:", err);
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
    console.log(`[Kafka] Published ${eventName} to topic ${topic}`);
  } catch (error) {
    console.error(`[Kafka] Failed to publish ${eventName}:`, error);
  }
}

export async function publishReviewCreated(data: ReviewCreatedEvent) {
  await sendEvent("review.created", "review.created", data);
}

export async function publishReviewUpdated(data: ReviewUpdatedEvent) {
  await sendEvent("review.updated", "review.updated", data);
}

export async function publishReviewDeleted(data: ReviewDeletedEvent) {
  await sendEvent("review.deleted", "review.deleted", data);
}

export async function publishReviewApproved(data: ReviewApprovedEvent) {
  await sendEvent("review.approved", "review.approved", data);
}

export async function publishReviewRejected(data: ReviewRejectedEvent) {
  await sendEvent("review.rejected", "review.rejected", data);
}

export async function publishReviewReported(data: ReviewReportedEvent) {
  await sendEvent("review.reported", "review.reported", data);
}

export async function publishRatingSummaryUpdated(
  data: ProductRatingSummaryUpdatedEvent,
) {
  await sendEvent(
    "product.rating-summary.updated",
    "product.rating-summary.updated",
    data,
  );
}
