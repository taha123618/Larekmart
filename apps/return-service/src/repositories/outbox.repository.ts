import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { returnOutbox } from "../db/schema.js";

export class OutboxRepository {
  private db = getDb();

  async insertMessage(topic: string, eventKey: string | null, payload: unknown): Promise<string> {
    const id = uuidv4();
    await this.db.insert(returnOutbox).values({
      id,
      topic,
      eventKey: eventKey || null,
      payload: JSON.stringify(payload),
      status: "PENDING",
      retryCount: 0,
    });
    return id;
  }

  async getPendingMessages(limit = 50) {
    return this.db
      .select()
      .from(returnOutbox)
      .where(eq(returnOutbox.status, "PENDING"))
      .limit(limit);
  }

  async markPublished(id: string) {
    await this.db
      .update(returnOutbox)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
      })
      .where(eq(returnOutbox.id, id));
  }

  async markFailed(id: string, errorMessage: string) {
    await this.db
      .update(returnOutbox)
      .set({
        status: "FAILED",
        lastError: errorMessage,
        retryCount: sql`retry_count + 1`,
      })
      .where(eq(returnOutbox.id, id));
  }
}

export const outboxRepository = new OutboxRepository();
