import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { createKafkaClient, createProducer } from "@repo/kafka";
import { env } from "../config/env.js";

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private producer: ReturnType<typeof createProducer> | null = null;
  private isConnected = false;

  async onModuleInit() {
    if (env.NODE_ENV === "test") {
      this.logger.log(
        "Kafka running in test mode - real broker connection skipped",
      );
      return;
    }

    try {
      const brokers = env.KAFKA_BROKERS.split(",").map((b) => b.trim());
      const kafka = createKafkaClient("vendor-service", brokers);
      this.producer = createProducer(kafka);
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log("Kafka producer successfully connected");
    } catch (err) {
      this.logger.error("Failed to connect Kafka producer on startup", err);
    }
  }

  async onModuleDestroy() {
    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.logger.log("Kafka producer disconnected");
      } catch (err) {
        this.logger.error("Error disconnecting Kafka producer", err);
      }
    }
  }

  async emitEvent(topic: string, payload: object): Promise<void> {
    if (!this.isConnected || !this.producer) {
      this.logger.warn(
        `Kafka not connected. Emitting mock event for topic: ${topic}`,
      );
      return;
    }

    try {
      // Golden rule: Follow the Kafka envelope convention. producer.send(topic, { value: payload })
      await this.producer.send(topic, { value: payload });
      this.logger.log(`Published Kafka event to topic: ${topic}`);
    } catch (err) {
      this.logger.error(`Failed to publish Kafka event to topic ${topic}`, err);
    }
  }
}
