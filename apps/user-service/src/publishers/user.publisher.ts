import { producer } from "../utils/kafka.js";
import type { UserEventName } from "@repo/types";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../observability/metrics.js";

export { producer };

export async function initProducer(): Promise<void> {
  await producer.connect();
  logger.info("Kafka producer connected in user-service");
}

export async function publishUserEvent(
  eventType: UserEventName,
  userId: string,
  data: Record<string, unknown>,
  authUserId?: string,
): Promise<void> {
  const eventId = `evt_${uuidv4()}`;
  const timestamp = new Date().toISOString();

  const payload = {
    eventId,
    eventType,
    userId,
    authUserId,
    timestamp,
    data,
  };

  try {
    await producer.send(eventType, { value: payload });
    logger.info(`Published ${eventType} event for user ${userId}`, { eventId });
  } catch (error) {
    logger.error(`Failed to publish Kafka event ${eventType}`, { error, payload });
  }
}
