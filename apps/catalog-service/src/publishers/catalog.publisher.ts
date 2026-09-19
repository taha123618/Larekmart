import { producer } from "../utils/kafka.js";
import { logger } from "../observability/metrics.js";

export async function publishCatalogEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await producer.send(topic, { value: payload });
    logger.info(`Published catalog event to ${topic}`);
  } catch (error) {
    logger.warn(`Failed to publish event to ${topic}`, { error: String(error) });
  }
}
