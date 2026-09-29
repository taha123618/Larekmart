import { consumer } from "../utils/kafka.js";
import { logger } from "../observability/metrics.js";
import { handleAuthUserCreated } from "./auth.consumer.js";

export { consumer };

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "user.created",
        topicHandler: async (msg) => {
          if (msg.value) await handleAuthUserCreated(msg.value);
        },
      },
      {
        topicName: "auth.user_created",
        topicHandler: async (msg) => {
          if (msg.value) await handleAuthUserCreated(msg.value);
        },
      },
      {
        topicName: "user.registered",
        topicHandler: async (msg) => {
          if (msg.value) await handleAuthUserCreated(msg.value);
        },
      },
    ]);
    logger.info(
      "User-service Kafka consumers successfully connected and subscribed",
    );
  } catch (err) {
    logger.warn("Kafka consumer connection deferred / offline", {
      error: String(err),
    });
  }
}
