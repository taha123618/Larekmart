import { eq, and, or, lt, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/connection.js";
import { returnOutbox } from "../db/schema.js";

export class OutboxRepository {
  private db = getDb();

  async insertMessage(
    topic: string,
    eventKey: string | null,
    payload: unknown,
  ): Promise<string> {
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

  /**
   * Atomically claims pending or expired outbox messages with worker fencing.
   */
  async claimPendingMessages(limit = 50, leaseMs = 30000, workerId?: string) {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + leaseMs);

    const candidates = await this.db
      .select()
      .from(returnOutbox)
      .where(
        or(
          eq(returnOutbox.status, "PENDING"),
          and(
            eq(returnOutbox.status, "CLAIMED"),
            lt(returnOutbox.lockedUntil, now),
          ),
        ),
      )
      .limit(limit);

    const claimed: (typeof returnOutbox.$inferSelect)[] = [];
    for (const msg of candidates) {
      await this.db
        .update(returnOutbox)
        .set({
          status: "CLAIMED",
          lockedUntil: leaseUntil,
          lockedBy: workerId ?? null,
        })
        .where(
          and(
            eq(returnOutbox.id, msg.id),
            or(
              eq(returnOutbox.status, "PENDING"),
              and(
                eq(returnOutbox.status, "CLAIMED"),
                lt(returnOutbox.lockedUntil, now),
              ),
            ),
          ),
        );

      claimed.push({
        ...msg,
        status: "CLAIMED",
        lockedUntil: leaseUntil,
        lockedBy: workerId ?? null,
      });
    }

    return claimed;
  }

  async markPublished(id: string, workerId?: string) {
    const condition = workerId
      ? and(eq(returnOutbox.id, id), eq(returnOutbox.lockedBy, workerId))
      : eq(returnOutbox.id, id);

    await this.db
      .update(returnOutbox)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
        lockedUntil: null,
      })
      .where(condition);
  }

  async markFailed(id: string, errorMessage: string, workerId?: string) {
    const condition = workerId
      ? and(eq(returnOutbox.id, id), eq(returnOutbox.lockedBy, workerId))
      : eq(returnOutbox.id, id);

    await this.db
      .update(returnOutbox)
      .set({
        status: "FAILED",
        lastError: errorMessage,
        retryCount: sql`retry_count + 1`,
        lockedUntil: null,
      })
      .where(condition);
  }
}

export const outboxRepository = new OutboxRepository();
