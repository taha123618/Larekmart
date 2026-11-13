import { consumer } from "../utils/kafka.js";
import { logger } from "../observability/metrics.js";
import {
  handleAuthUserCreated,
  handleSellerPrivilegeGranted,
} from "./auth.consumer.js";

export { consumer };

export async function startKafkaConsumers(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe([
      {
        topicName: "user.created",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleAuthUserCreated(payload);
        },
      },
      {
        topicName: "user.updated",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleAuthUserCreated(payload);
        },
      },
      {
        topicName: "auth.user_created",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleAuthUserCreated(payload);
        },
      },
      {
        topicName: "user.registered",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleAuthUserCreated(payload);
        },
      },
      {
        topicName: "seller.created",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleSellerPrivilegeGranted(payload);
        },
      },
      {
        topicName: "seller.activated",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleSellerPrivilegeGranted(payload);
        },
      },
      {
        topicName: "vendor.verified",
        topicHandler: async (msg) => {
          const payload = msg?.value ?? msg;
          if (payload) await handleSellerPrivilegeGranted(payload);
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
