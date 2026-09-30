import { mediaMetrics, logger } from "../../observability/metrics.js";
import { producer } from "../../utils/kafka.js";
import type { MediaEventPayloadType } from "@repo/types";

/**
 * Publishes media lifecycle events using the repository-established envelope:
 * `producer.send(topic, { value: payload })` (spec section 20 — no second
 * event format). Failures are counted + logged, never fatal to the caller:
 * Kafka propagation is asynchronous by design.
 */
export async function publishMediaEvent(
  eventType: string,
  payload: Omit<MediaEventPayloadType, "eventId" | "eventType" | "occurredAt">,
): Promise<void> {
  const event: MediaEventPayloadType = {
    eventId: crypto.randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    ...payload,
  };

  try {
    await producer.send(eventType, { value: event });
    mediaMetrics.kafka_events_published_total.inc({ event: eventType });
    logger.info(`Published ${eventType} for media ${event.mediaId}`);
  } catch (error) {
    mediaMetrics.kafka_event_failures_total.inc({ event: eventType });
    logger.error(`Failed to publish ${eventType}`, error);
  }
}
