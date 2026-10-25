import { pool, getDbStatus } from "../db.js";
import { createLogger } from "@repo/monitoring";

const logger = createLogger("analytic-service:event-batcher");

export interface BufferedAnalyticsEvent {
  eventType: string;
  userId: string | null;
  amount: number | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

class EventBatcher {
  private queue: BufferedAnalyticsEvent[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isFlushing = false;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;

  constructor(maxBatchSize = 500, flushIntervalMs = 1000) {
    this.maxBatchSize = maxBatchSize;
    this.flushIntervalMs = flushIntervalMs;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => {
        logger.error("Error during scheduled event batch flush:", err);
      });
    }, this.flushIntervalMs);

    logger.info(
      `Analytics Event Batcher started (Max Batch: ${this.maxBatchSize}, Flush Interval: ${this.flushIntervalMs}ms)`,
    );
  }

  public stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this.flush();
  }

  public enqueue(event: BufferedAnalyticsEvent): void {
    this.queue.push(event);
    if (this.queue.length >= this.maxBatchSize) {
      // Fire-and-forget flush when buffer reaches threshold
      this.flush().catch((err) => {
        logger.error("Error during threshold event batch flush:", err);
      });
    }
  }

  public async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) return;
    if (!getDbStatus()) {
      // Retain up to 2000 events in memory if database is temporarily offline
      if (this.queue.length > 2000) {
        this.queue.splice(0, this.queue.length - 2000);
      }
      return;
    }

    this.isFlushing = true;
    const batch = this.queue.splice(0, this.maxBatchSize);

    try {
      const client = await pool.connect();
      try {
        // Construct parameterized multi-row INSERT statement:
        // INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
        // VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)...
        const values: unknown[] = [];
        const valuePlaceholders: string[] = [];

        for (let i = 0; i < batch.length; i++) {
          const evt = batch[i]!;
          const offset = i * 5;
          valuePlaceholders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
          );
          values.push(
            evt.eventType,
            evt.userId,
            evt.amount,
            JSON.stringify(evt.metadata || {}),
            evt.createdAt,
          );
        }

        const query = `
          INSERT INTO analytics_events (event_type, user_id, amount, metadata, created_at)
          VALUES ${valuePlaceholders.join(", ")}
        `;

        await client.query(query, values);
        logger.info(
          `Successfully flushed batch of ${batch.length} analytics events to PostgreSQL`,
        );
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error("Failed to flush analytics event batch to database:", error);
      // Re-queue the failed batch at the beginning of the queue for retry (up to max queue size)
      this.queue.unshift(...batch);
      if (this.queue.length > 2000) {
        this.queue.splice(2000);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }
}

export const eventBatcher = new EventBatcher(500, 1000);
